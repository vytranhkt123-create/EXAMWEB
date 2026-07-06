using System.Buffers;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Security.Claims;
using System.Text;
using System.Text.Json;

namespace ExamWeb.Server.Services
{
    public class ArenaSocketManager
    {
        private const int MaxInboundMessageBytes = 1024 * 1024;
        private const int DefaultQuestionDurationSeconds = 20;

        private static readonly ConcurrentDictionary<string, ArenaRoom> _rooms = new();
        private readonly ConcurrentDictionary<string, ArenaSocketConnection> _connections = new();
        private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);

        public static string CreateRoom(string testId, string testName, List<ArenaQuestionDto> questions)
        {
            var random = new Random();
            string roomId;
            do
            {
                roomId = random.Next(100000, 999999).ToString();
            } while (_rooms.ContainsKey(roomId));

            var room = new ArenaRoom
            {
                RoomId = roomId,
                TestId = testId,
                TestName = testName,
                Questions = questions,
                CurrentQuestionIndex = -1,
                Phase = ArenaRoom.PhaseLobby,
                QuestionDurationSeconds = DefaultQuestionDurationSeconds
            };

            _rooms[roomId] = room;
            return roomId;
        }

        public async Task HandleConnectionAsync(HttpContext context)
        {
            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }

            using var webSocket = await context.WebSockets.AcceptWebSocketAsync();

            var accountIdClaim = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            int? accountId = int.TryParse(accountIdClaim, out var parsedAccountId) ? parsedAccountId : null;
            var displayName = context.User.FindFirstValue(ClaimTypes.Name) ?? context.User.FindFirstValue("username") ?? "Guest";
            var role = context.User.FindFirstValue(ClaimTypes.Role) ?? context.User.FindFirstValue("role") ?? "User";

            var connection = new ArenaSocketConnection(
                "Arena_" + Guid.NewGuid().ToString("N"),
                webSocket,
                accountId,
                displayName,
                role);

            _connections[connection.ConnectionId] = connection;

            try
            {
                await SendAsync(connection, ArenaEvents.Connected, new
                {
                    connectionId = connection.ConnectionId
                }, context.RequestAborted);

                await ReceiveLoopAsync(connection, context.RequestAborted);
            }
            catch (OperationCanceledException)
            {
            }
            catch (WebSocketException)
            {
            }
            finally
            {
                await HandleDisconnectAsync(connection);
            }
        }

        private async Task HandleDisconnectAsync(ArenaSocketConnection connection)
        {
            _connections.TryRemove(connection.ConnectionId, out _);

            if (!string.IsNullOrEmpty(connection.RoomId) &&
                _rooms.TryGetValue(connection.RoomId, out var room))
            {
                if (connection.ConnectionId == room.HostConnectionId)
                {
                    room.HostConnectionId = string.Empty;
                    await BroadcastToRoomAsync(connection.RoomId, ArenaEvents.HostDisconnected, new
                    {
                        message = "Giáo viên đã rời phòng."
                    });
                }
                else if (room.Players.TryRemove(connection.ConnectionId, out _))
                {
                    await BroadcastToRoomAsync(connection.RoomId, ArenaEvents.PlayerLeft, new
                    {
                        connectionId = connection.ConnectionId,
                        players = GetSanitizedPlayers(room),
                        answerStats = GetAnswerStats(room),
                        leaderboard = GetLeaderboard(room)
                    });
                    await BroadcastLeaderboardUpdatedAsync(room);
                }
            }

            try
            {
                connection.Socket.Abort();
            }
            catch
            {
            }
        }

        private async Task ReceiveLoopAsync(ArenaSocketConnection connection, CancellationToken cancellationToken)
        {
            var buffer = ArrayPool<byte>.Shared.Rent(16 * 1024);
            try
            {
                while (connection.Socket.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
                {
                    using var messageStream = new MemoryStream();
                    var receivedBytes = 0;
                    WebSocketReceiveResult result;

                    do
                    {
                        result = await connection.Socket.ReceiveAsync(
                            new ArraySegment<byte>(buffer),
                            cancellationToken);

                        if (result.MessageType == WebSocketMessageType.Close)
                        {
                            await connection.Socket.CloseAsync(
                                WebSocketCloseStatus.NormalClosure,
                                "closed",
                                cancellationToken);
                            return;
                        }

                        receivedBytes += result.Count;
                        if (receivedBytes > MaxInboundMessageBytes)
                        {
                            await connection.Socket.CloseAsync(
                                WebSocketCloseStatus.MessageTooBig,
                                "message too large",
                                cancellationToken);
                            return;
                        }

                        messageStream.Write(buffer, 0, result.Count);
                    }
                    while (!result.EndOfMessage);

                    var rawMessage = Encoding.UTF8.GetString(
                        messageStream.GetBuffer(),
                        0,
                        checked((int)messageStream.Length));
                    await HandleClientMessageAsync(connection, rawMessage, cancellationToken);
                }
            }
            finally
            {
                ArrayPool<byte>.Shared.Return(buffer);
            }
        }

        private async Task HandleClientMessageAsync(
            ArenaSocketConnection connection,
            string rawMessage,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(rawMessage))
            {
                return;
            }

            using var document = JsonDocument.Parse(rawMessage);
            if (!document.RootElement.TryGetProperty("type", out var typeElement))
            {
                return;
            }

            var type = NormalizeClientMessageType(typeElement.GetString());
            if (string.IsNullOrWhiteSpace(type))
            {
                return;
            }

            if (type == ArenaClientEvents.Ping)
            {
                await SendAsync(connection, ArenaEvents.Pong, new { at = DateTime.UtcNow }, cancellationToken);
                return;
            }

            if (type == ArenaClientEvents.JoinRoom)
            {
                await HandleJoinRoomAsync(connection, document.RootElement, cancellationToken);
                return;
            }

            if (string.IsNullOrEmpty(connection.RoomId) ||
                !_rooms.TryGetValue(connection.RoomId, out var activeRoom))
            {
                return;
            }

            if (type == ArenaClientEvents.StartGame)
            {
                if (!IsHost(connection, activeRoom)) return;
                await BeginCountdownAndStartAsync(activeRoom, cancellationToken);
                return;
            }

            if (type == ArenaClientEvents.NextQuestion)
            {
                if (!IsHost(connection, activeRoom)) return;

                if (activeRoom.Phase == ArenaRoom.PhaseLobby || activeRoom.CurrentQuestionIndex < 0)
                {
                    await BeginCountdownAndStartAsync(activeRoom, cancellationToken);
                }
                else
                {
                    await StartNextQuestionAsync(activeRoom, cancellationToken);
                }
                return;
            }

            if (type == ArenaClientEvents.SubmitAnswer)
            {
                await HandleSubmitAnswerAsync(connection, activeRoom, document.RootElement, cancellationToken);
                return;
            }

            if (type == ArenaClientEvents.ShowResults)
            {
                if (!IsHost(connection, activeRoom)) return;
                await EndQuestionAsync(activeRoom, cancellationToken);
                return;
            }

            if (type == ArenaClientEvents.ShowLeaderboard)
            {
                if (!IsHost(connection, activeRoom)) return;
                await BroadcastLeaderboardUpdatedAsync(activeRoom, cancellationToken);
            }
        }

        private async Task HandleJoinRoomAsync(
            ArenaSocketConnection connection,
            JsonElement root,
            CancellationToken cancellationToken)
        {
            if (!root.TryGetProperty("payload", out var payload))
            {
                await SendAsync(connection, ArenaEvents.Error, new { message = "Thiếu dữ liệu tham gia phòng." }, cancellationToken);
                return;
            }

            var roomId = GetString(payload, "roomId") ?? GetString(payload, "pin") ?? string.Empty;
            var requestedRole = GetString(payload, "role") ?? "player";
            var requestedName = GetString(payload, "name") ?? connection.DisplayName;

            if (!_rooms.TryGetValue(roomId, out var room))
            {
                await SendAsync(connection, ArenaEvents.Error, new { message = "Mã PIN không tồn tại." }, cancellationToken);
                return;
            }

            connection.RoomId = roomId;

            if (string.Equals(requestedRole, "host", StringComparison.OrdinalIgnoreCase) &&
                (connection.IsAdmin || string.Equals(connection.Role, "Admin", StringComparison.OrdinalIgnoreCase)))
            {
                room.HostConnectionId = connection.ConnectionId;
                await SendAsync(connection, ArenaEvents.RoomState, GetRoomStateForHost(room), cancellationToken);
                await BroadcastLeaderboardUpdatedAsync(room, cancellationToken);
                return;
            }

            var playerName = string.IsNullOrWhiteSpace(requestedName)
                ? "Học sinh ẩn danh"
                : requestedName.Trim();

            if (playerName.Length > 40)
            {
                playerName = playerName[..40];
            }

            var player = new ArenaPlayer
            {
                ConnectionId = connection.ConnectionId,
                Name = playerName,
                Score = 0
            };

            room.Players[connection.ConnectionId] = player;

            await SendAsync(connection, ArenaEvents.RoomState, GetRoomStateForPlayer(room, connection.ConnectionId), cancellationToken);
            await BroadcastToRoomAsync(roomId, ArenaEvents.PlayerJoined, new
            {
                player = SanitizePlayer(player),
                players = GetSanitizedPlayers(room),
                answerStats = GetAnswerStats(room),
                leaderboard = GetLeaderboard(room)
            }, cancellationToken);
            await BroadcastLeaderboardUpdatedAsync(room, cancellationToken);
        }

        private async Task BeginCountdownAndStartAsync(ArenaRoom room, CancellationToken cancellationToken)
        {
            if (room.Questions.Count == 0)
            {
                await CompleteGameAsync(room, cancellationToken);
                return;
            }

            room.Phase = ArenaRoom.PhaseCountdown;
            room.ShowAnswers = false;
            room.CountdownEndsAt = DateTime.UtcNow.AddSeconds(room.CountdownSeconds);
            room.IsClosed = false;

            await BroadcastRoomStateToEveryone(room, cancellationToken);
            await BroadcastToRoomAsync(room.RoomId, ArenaEvents.GameStarted, new
            {
                phase = room.Phase,
                countdownSeconds = room.CountdownSeconds,
                countdownEndsAt = room.CountdownEndsAt,
                roomId = room.RoomId,
                testName = room.TestName
            }, cancellationToken);

            await Task.Delay(TimeSpan.FromSeconds(room.CountdownSeconds), cancellationToken);

            if (room.Phase == ArenaRoom.PhaseCountdown)
            {
                await StartNextQuestionAsync(room, cancellationToken);
            }
        }

        private async Task StartNextQuestionAsync(ArenaRoom room, CancellationToken cancellationToken)
        {
            if (room.CurrentQuestionIndex + 1 >= room.Questions.Count)
            {
                await CompleteGameAsync(room, cancellationToken);
                return;
            }

            room.CurrentQuestionIndex++;
            room.Phase = ArenaRoom.PhaseInGame;
            room.ShowAnswers = false;
            room.QuestionStartTime = DateTime.UtcNow;
            room.QuestionEndsAt = room.QuestionStartTime.Value.AddSeconds(room.QuestionDurationSeconds);
            room.CountdownEndsAt = null;

            foreach (var player in room.Players.Values)
            {
                player.HasAnswered = false;
                player.SelectedAnswerId = null;
                player.ScoreDelta = 0;
                player.LastAnswerCorrect = null;
                player.SpeedBonus = 0;
                player.StreakBonus = 0;
                player.LastAnswerMs = null;
            }

            await BroadcastRoomStateToEveryone(room, cancellationToken);
            await BroadcastToRoomAsync(room.RoomId, ArenaEvents.QuestionShown, new
            {
                phase = room.Phase,
                currentQuestionIndex = room.CurrentQuestionIndex,
                totalQuestions = room.Questions.Count,
                questionDurationSeconds = room.QuestionDurationSeconds,
                questionEndsAt = room.QuestionEndsAt,
                answerStats = GetAnswerStats(room),
                leaderboard = GetLeaderboard(room)
            }, cancellationToken);
        }

        private async Task HandleSubmitAnswerAsync(
            ArenaSocketConnection connection,
            ArenaRoom room,
            JsonElement root,
            CancellationToken cancellationToken)
        {
            if (room.Phase != ArenaRoom.PhaseInGame || room.ShowAnswers)
            {
                return;
            }

            if (!room.Players.TryGetValue(connection.ConnectionId, out var player))
            {
                return;
            }

            if (room.CurrentQuestionIndex < 0 || room.CurrentQuestionIndex >= room.Questions.Count || player.HasAnswered)
            {
                return;
            }

            if (!root.TryGetProperty("payload", out var payload))
            {
                return;
            }

            var answerId = GetString(payload, "answerId");
            if (string.IsNullOrWhiteSpace(answerId))
            {
                return;
            }

            var currentQuestion = room.Questions[room.CurrentQuestionIndex];
            var selectedAnswer = currentQuestion.Answers.FirstOrDefault(a => a.Id == answerId);
            var previousRank = GetPlayerRank(room, player.ConnectionId);
            var elapsed = room.QuestionStartTime.HasValue
                ? DateTime.UtcNow - room.QuestionStartTime.Value
                : TimeSpan.Zero;

            player.HasAnswered = true;
            player.SelectedAnswerId = answerId;
            player.LastAnswerMs = Math.Max(0, (int)Math.Round(elapsed.TotalMilliseconds));

            var isCorrect = selectedAnswer?.IsCorrect == true;
            if (isCorrect)
            {
                player.Streak++;
                var baseScore = GetArenaBaseScore(currentQuestion.Score);
                var duration = Math.Max(1, room.QuestionDurationSeconds);
                var speedRatio = Math.Clamp(1 - elapsed.TotalSeconds / duration, 0, 1);
                var speedWeightedScore = (int)Math.Round(baseScore * (0.55 + speedRatio * 0.45));
                var minimumSpeedScore = (int)Math.Round(baseScore * 0.55);

                player.SpeedBonus = Math.Max(0, speedWeightedScore - minimumSpeedScore);
                player.StreakBonus = player.Streak >= 3 ? Math.Min(500, player.Streak * 50) : 0;
                player.ScoreDelta = speedWeightedScore + player.StreakBonus;
                player.Score += player.ScoreDelta;
                player.LastAnswerCorrect = true;
            }
            else
            {
                player.Streak = 0;
                player.SpeedBonus = 0;
                player.StreakBonus = 0;
                player.ScoreDelta = 0;
                player.LastAnswerCorrect = false;
            }

            var currentRank = GetPlayerRank(room, player.ConnectionId);
            var answerStats = GetAnswerStats(room);
            var submitPayload = new
            {
                connectionId = player.ConnectionId,
                playerName = player.Name,
                selectedAnswerId = answerId,
                isCorrect,
                score = player.Score,
                scoreDelta = player.ScoreDelta,
                streak = player.Streak,
                speedBonus = player.SpeedBonus,
                streakBonus = player.StreakBonus,
                responseMs = player.LastAnswerMs,
                rank = currentRank,
                previousRank,
                answerStats
            };

            await SendAsync(connection, ArenaEvents.AnswerSubmitted, submitPayload, cancellationToken);
            await SendToConnectionIdAsync(room.HostConnectionId, ArenaEvents.AnswerSubmitted, submitPayload, cancellationToken);
            await BroadcastLeaderboardUpdatedAsync(room, cancellationToken);

            var stats = BuildAnswerStats(room);
            if (stats.TotalPlayers > 0 && stats.AnsweredCount == stats.TotalPlayers)
            {
                await EndQuestionAsync(room, cancellationToken);
            }
        }

        private async Task EndQuestionAsync(ArenaRoom room, CancellationToken cancellationToken)
        {
            if (room.CurrentQuestionIndex < 0 || room.CurrentQuestionIndex >= room.Questions.Count)
            {
                return;
            }

            room.Phase = ArenaRoom.PhaseResult;
            room.ShowAnswers = true;
            room.QuestionEndsAt = DateTime.UtcNow;

            await BroadcastRoomStateToEveryone(room, cancellationToken);
            await BroadcastToRoomAsync(room.RoomId, ArenaEvents.QuestionResult, new
            {
                phase = room.Phase,
                currentQuestionIndex = room.CurrentQuestionIndex,
                answerStats = GetAnswerStats(room),
                leaderboard = GetLeaderboard(room)
            }, cancellationToken);
            await BroadcastLeaderboardUpdatedAsync(room, cancellationToken);
        }

        private async Task CompleteGameAsync(ArenaRoom room, CancellationToken cancellationToken)
        {
            room.Phase = ArenaRoom.PhasePodium;
            room.ShowAnswers = true;
            room.IsClosed = true;
            room.QuestionEndsAt = DateTime.UtcNow;

            await BroadcastRoomStateToEveryone(room, cancellationToken);
            await BroadcastToRoomAsync(room.RoomId, ArenaEvents.GameOver, new
            {
                phase = room.Phase,
                leaderboard = GetLeaderboard(room),
                podium = GetLeaderboard(room).Take(3).ToList()
            }, cancellationToken);
            await BroadcastLeaderboardUpdatedAsync(room, cancellationToken);
        }

        private async Task BroadcastRoomStateToEveryone(ArenaRoom room, CancellationToken cancellationToken)
        {
            if (!string.IsNullOrEmpty(room.HostConnectionId))
            {
                await SendToConnectionIdAsync(room.HostConnectionId, ArenaEvents.RoomState, GetRoomStateForHost(room), cancellationToken);
            }

            foreach (var playerConnId in room.Players.Keys)
            {
                await SendToConnectionIdAsync(playerConnId, ArenaEvents.RoomState, GetRoomStateForPlayer(room, playerConnId), cancellationToken);
            }
        }

        private async Task BroadcastLeaderboardUpdatedAsync(
            ArenaRoom room,
            CancellationToken cancellationToken = default)
        {
            await BroadcastToRoomAsync(room.RoomId, ArenaEvents.LeaderboardUpdated, new
            {
                leaderboard = GetLeaderboard(room),
                answerStats = GetAnswerStats(room)
            }, cancellationToken);
        }

        private object GetRoomStateForHost(ArenaRoom room)
        {
            return new
            {
                roomId = room.RoomId,
                testId = room.TestId,
                testName = room.TestName,
                phase = room.Phase,
                currentQuestionIndex = room.CurrentQuestionIndex,
                totalQuestions = room.Questions.Count,
                showAnswers = room.ShowAnswers,
                gameOver = room.Phase == ArenaRoom.PhasePodium,
                countdownEndsAt = room.CountdownEndsAt,
                questionStartedAt = room.QuestionStartTime,
                questionEndsAt = room.QuestionEndsAt,
                questionDurationSeconds = room.QuestionDurationSeconds,
                players = GetSanitizedPlayers(room),
                currentQuestion = GetCurrentQuestionPayload(room, includeCorrectAnswers: true),
                answerStats = GetAnswerStats(room),
                answeredCount = room.Players.Values.Count(p => p.HasAnswered),
                totalPlayers = room.Players.Count,
                leaderboard = GetLeaderboard(room)
            };
        }

        private object GetRoomStateForPlayer(ArenaRoom room, string playerConnectionId)
        {
            room.Players.TryGetValue(playerConnectionId, out var currentPlayer);

            return new
            {
                roomId = room.RoomId,
                testName = room.TestName,
                phase = room.Phase,
                currentQuestionIndex = room.CurrentQuestionIndex,
                totalQuestions = room.Questions.Count,
                showAnswers = room.ShowAnswers,
                gameOver = room.Phase == ArenaRoom.PhasePodium,
                countdownEndsAt = room.CountdownEndsAt,
                questionStartedAt = room.QuestionStartTime,
                questionEndsAt = room.QuestionEndsAt,
                questionDurationSeconds = room.QuestionDurationSeconds,
                currentPlayer = currentPlayer == null ? null : new
                {
                    connectionId = currentPlayer.ConnectionId,
                    name = currentPlayer.Name,
                    score = currentPlayer.Score,
                    hasAnswered = currentPlayer.HasAnswered,
                    selectedAnswerId = currentPlayer.SelectedAnswerId,
                    scoreDelta = currentPlayer.ScoreDelta,
                    lastAnswerCorrect = currentPlayer.LastAnswerCorrect,
                    streak = currentPlayer.Streak,
                    speedBonus = currentPlayer.SpeedBonus,
                    streakBonus = currentPlayer.StreakBonus,
                    lastAnswerMs = currentPlayer.LastAnswerMs,
                    rank = GetPlayerRank(room, currentPlayer.ConnectionId)
                },
                currentQuestion = GetCurrentQuestionPayload(room, includeCorrectAnswers: room.ShowAnswers),
                answerStats = GetAnswerStats(room),
                leaderboard = GetLeaderboard(room)
            };
        }

        private object? GetCurrentQuestionPayload(ArenaRoom room, bool includeCorrectAnswers)
        {
            if (room.CurrentQuestionIndex < 0 || room.CurrentQuestionIndex >= room.Questions.Count)
            {
                return null;
            }

            var currentQuestion = room.Questions[room.CurrentQuestionIndex];
            return new
            {
                id = currentQuestion.Id,
                content = currentQuestion.Content,
                questionType = currentQuestion.QuestionType,
                imageUrl = currentQuestion.ImageUrl,
                score = currentQuestion.Score,
                orderIndex = currentQuestion.OrderIndex,
                answers = currentQuestion.Answers.Select(a => new
                {
                    id = a.Id,
                    content = a.Content,
                    orderIndex = a.OrderIndex,
                    isCorrect = includeCorrectAnswers ? a.IsCorrect : (bool?)null
                }).ToList()
            };
        }

        private static object SanitizePlayer(ArenaPlayer player)
        {
            return new
            {
                connectionId = player.ConnectionId,
                name = player.Name,
                score = player.Score,
                hasAnswered = player.HasAnswered,
                streak = player.Streak
            };
        }

        private static List<object> GetSanitizedPlayers(ArenaRoom room)
        {
            return room.Players.Values
                .Select(SanitizePlayer)
                .ToList();
        }

        private static List<object> GetLeaderboard(ArenaRoom room)
        {
            return BuildLeaderboard(room)
                .Select(entry => (object)new
                {
                    rank = entry.Rank,
                    connectionId = entry.ConnectionId,
                    name = entry.Name,
                    score = entry.Score,
                    scoreDelta = entry.ScoreDelta,
                    lastAnswerCorrect = entry.LastAnswerCorrect,
                    streak = entry.Streak,
                    hasAnswered = entry.HasAnswered,
                    speedBonus = entry.SpeedBonus,
                    streakBonus = entry.StreakBonus,
                    responseMs = entry.LastAnswerMs
                })
                .ToList();
        }

        private static List<ArenaLeaderboardEntry> BuildLeaderboard(ArenaRoom room)
        {
            return room.Players.Values
                .OrderByDescending(p => p.Score)
                .ThenByDescending(p => p.ScoreDelta)
                .ThenBy(p => p.Name)
                .Select((p, idx) => new ArenaLeaderboardEntry
                {
                    Rank = idx + 1,
                    ConnectionId = p.ConnectionId,
                    Name = p.Name,
                    Score = p.Score,
                    ScoreDelta = p.ScoreDelta,
                    LastAnswerCorrect = p.LastAnswerCorrect,
                    Streak = p.Streak,
                    HasAnswered = p.HasAnswered,
                    SpeedBonus = p.SpeedBonus,
                    StreakBonus = p.StreakBonus,
                    LastAnswerMs = p.LastAnswerMs
                })
                .ToList();
        }

        private static int? GetPlayerRank(ArenaRoom room, string connectionId)
        {
            return BuildLeaderboard(room)
                .FirstOrDefault(entry => entry.ConnectionId == connectionId)
                ?.Rank;
        }

        private static object GetAnswerStats(ArenaRoom room)
        {
            var stats = BuildAnswerStats(room);
            return new
            {
                answeredCount = stats.AnsweredCount,
                totalPlayers = stats.TotalPlayers,
                correctCount = stats.CorrectCount,
                wrongCount = stats.WrongCount,
                pendingCount = stats.PendingCount,
                accuracyPercent = stats.AccuracyPercent
            };
        }

        private static ArenaAnswerStats BuildAnswerStats(ArenaRoom room)
        {
            var answeredCount = room.Players.Values.Count(p => p.HasAnswered);
            var correctCount = room.Players.Values.Count(p => p.LastAnswerCorrect == true);
            var wrongCount = room.Players.Values.Count(p => p.LastAnswerCorrect == false);
            var totalPlayers = room.Players.Count;

            return new ArenaAnswerStats
            {
                AnsweredCount = answeredCount,
                TotalPlayers = totalPlayers,
                CorrectCount = correctCount,
                WrongCount = wrongCount,
                PendingCount = Math.Max(0, totalPlayers - answeredCount),
                AccuracyPercent = answeredCount == 0
                    ? 0
                    : (int)Math.Round(correctCount * 100.0 / answeredCount)
            };
        }

        private static int GetArenaBaseScore(decimal questionScore)
        {
            if (questionScore <= 0)
            {
                return 1000;
            }

            return Math.Max(100, (int)Math.Round(questionScore * 1000));
        }

        private static bool IsHost(ArenaSocketConnection connection, ArenaRoom room)
        {
            return !string.IsNullOrWhiteSpace(room.HostConnectionId) &&
                connection.ConnectionId == room.HostConnectionId;
        }

        private static string? GetString(JsonElement element, string propertyName)
        {
            if (!element.TryGetProperty(propertyName, out var property) ||
                property.ValueKind == JsonValueKind.Null ||
                property.ValueKind == JsonValueKind.Undefined)
            {
                return null;
            }

            return property.GetString();
        }

        private static string NormalizeClientMessageType(string? rawType)
        {
            if (string.IsNullOrWhiteSpace(rawType))
            {
                return string.Empty;
            }

            var normalized = rawType.Trim().Replace("-", string.Empty).Replace("_", string.Empty).ToLowerInvariant();
            return normalized switch
            {
                "ping" => ArenaClientEvents.Ping,
                "joinroom" => ArenaClientEvents.JoinRoom,
                "startgame" => ArenaClientEvents.StartGame,
                "startquestion" => ArenaClientEvents.NextQuestion,
                "nextquestion" => ArenaClientEvents.NextQuestion,
                "submitanswer" => ArenaClientEvents.SubmitAnswer,
                "showresults" => ArenaClientEvents.ShowResults,
                "showleaderboard" => ArenaClientEvents.ShowLeaderboard,
                _ => rawType.Trim()
            };
        }

        private async Task SendToConnectionIdAsync(
            string connectionId,
            string eventType,
            object? payload,
            CancellationToken cancellationToken = default)
        {
            if (!string.IsNullOrEmpty(connectionId) && _connections.TryGetValue(connectionId, out var connection))
            {
                await SendAsync(connection, eventType, payload, cancellationToken);
            }
        }

        private async Task BroadcastToRoomAsync(
            string roomId,
            string eventType,
            object? payload,
            CancellationToken cancellationToken = default)
        {
            var connections = _connections.Values
                .Where(x => string.Equals(x.RoomId, roomId, StringComparison.Ordinal))
                .ToList();
            var bytes = Encoding.UTF8.GetBytes(SerializeEnvelope(eventType, payload));
            var staleConnections = new ConcurrentBag<string>();

            var sendTasks = connections.Select(async connection =>
            {
                try
                {
                    await SendSerializedAsync(connection, bytes, cancellationToken);
                }
                catch
                {
                    staleConnections.Add(connection.ConnectionId);
                }
            });

            await Task.WhenAll(sendTasks);

            foreach (var connId in staleConnections)
            {
                if (_connections.TryGetValue(connId, out var staleConnection))
                {
                    await HandleDisconnectAsync(staleConnection);
                }
            }
        }

        private async Task SendAsync(
            ArenaSocketConnection connection,
            string type,
            object? payload,
            CancellationToken cancellationToken = default)
        {
            if (connection.Socket.State != WebSocketState.Open)
            {
                throw new WebSocketException("Socket is not open.");
            }

            var bytes = Encoding.UTF8.GetBytes(SerializeEnvelope(type, payload));
            await SendSerializedAsync(connection, bytes, cancellationToken);
        }

        private async Task SendSerializedAsync(
            ArenaSocketConnection connection,
            byte[] bytes,
            CancellationToken cancellationToken)
        {
            if (connection.Socket.State != WebSocketState.Open)
            {
                throw new WebSocketException("Socket is not open.");
            }

            await connection.SendLock.WaitAsync(cancellationToken);
            try
            {
                if (connection.Socket.State != WebSocketState.Open)
                {
                    throw new WebSocketException("Socket is not open.");
                }

                await connection.Socket.SendAsync(
                    bytes,
                    WebSocketMessageType.Text,
                    true,
                    cancellationToken);
            }
            finally
            {
                connection.SendLock.Release();
            }
        }

        private string SerializeEnvelope(string type, object? payload)
        {
            return JsonSerializer.Serialize(new
            {
                type,
                payload
            }, _jsonOptions);
        }

        private static class ArenaClientEvents
        {
            public const string Ping = "Ping";
            public const string JoinRoom = "JoinRoom";
            public const string StartGame = "StartGame";
            public const string NextQuestion = "NextQuestion";
            public const string SubmitAnswer = "SubmitAnswer";
            public const string ShowResults = "ShowResults";
            public const string ShowLeaderboard = "ShowLeaderboard";
        }

        private static class ArenaEvents
        {
            public const string Connected = "Connected";
            public const string Pong = "Pong";
            public const string Error = "Error";
            public const string RoomState = "RoomState";
            public const string PlayerJoined = "PlayerJoined";
            public const string PlayerLeft = "PlayerLeft";
            public const string GameStarted = "GameStarted";
            public const string QuestionShown = "QuestionShown";
            public const string AnswerSubmitted = "AnswerSubmitted";
            public const string LeaderboardUpdated = "LeaderboardUpdated";
            public const string QuestionResult = "QuestionResult";
            public const string GameOver = "GameOver";
            public const string HostDisconnected = "HostDisconnected";
        }

        private sealed class ArenaSocketConnection
        {
            public ArenaSocketConnection(
                string connectionId,
                WebSocket socket,
                int? accountId,
                string displayName,
                string role)
            {
                ConnectionId = connectionId;
                Socket = socket;
                AccountId = accountId;
                DisplayName = displayName;
                Role = role;
            }

            public string ConnectionId { get; }
            public WebSocket Socket { get; }
            public int? AccountId { get; }
            public string DisplayName { get; }
            public string Role { get; }
            public bool IsAdmin => string.Equals(Role, "Admin", StringComparison.OrdinalIgnoreCase);
            public string? RoomId { get; set; }
            public SemaphoreSlim SendLock { get; } = new(1, 1);
        }

        private sealed class ArenaLeaderboardEntry
        {
            public int Rank { get; set; }
            public string ConnectionId { get; set; } = string.Empty;
            public string Name { get; set; } = string.Empty;
            public decimal Score { get; set; }
            public int ScoreDelta { get; set; }
            public bool? LastAnswerCorrect { get; set; }
            public int Streak { get; set; }
            public bool HasAnswered { get; set; }
            public int SpeedBonus { get; set; }
            public int StreakBonus { get; set; }
            public int? LastAnswerMs { get; set; }
        }

        private sealed class ArenaAnswerStats
        {
            public int AnsweredCount { get; set; }
            public int TotalPlayers { get; set; }
            public int CorrectCount { get; set; }
            public int WrongCount { get; set; }
            public int PendingCount { get; set; }
            public int AccuracyPercent { get; set; }
        }
    }
}
