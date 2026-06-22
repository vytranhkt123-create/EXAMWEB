using System.Collections.Concurrent;
using System.Buffers;
using System.Net.WebSockets;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using ExamWeb.Application.IService;
using ExamWeb.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ExamWeb.Server.Services
{
    public class ArenaSocketManager
    {
        private const int MaxInboundMessageBytes = 1024 * 1024;
        private readonly ConcurrentDictionary<string, ArenaSocketConnection> _connections = new();
        private static readonly ConcurrentDictionary<string, ArenaRoom> _rooms = new();
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);

        public ArenaSocketManager(IServiceScopeFactory scopeFactory)
        {
            _scopeFactory = scopeFactory;
        }

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
                CurrentQuestionIndex = -1
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
                role
            );

            _connections[connection.ConnectionId] = connection;

            try
            {
                await SendAsync(connection, "connected", new
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

            if (!string.IsNullOrEmpty(connection.RoomId) && _rooms.TryGetValue(connection.RoomId, out var room))
            {
                if (connection.ConnectionId == room.HostConnectionId)
                {
                    // If teacher disconnects, we can notify students but keep room for a while or clean up
                    await BroadcastToRoomAsync(connection.RoomId, "host-disconnected", new { message = "Giáo viên đã rời phòng." });
                }
                else
                {
                    room.Players.TryRemove(connection.ConnectionId, out _);
                    await BroadcastToRoomAsync(connection.RoomId, "player-left", new
                    {
                        connectionId = connection.ConnectionId,
                        players = GetSanitizedPlayers(room)
                    });
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

            var type = typeElement.GetString();
            if (string.IsNullOrWhiteSpace(type))
            {
                return;
            }

            if (type.Equals("ping", StringComparison.OrdinalIgnoreCase))
            {
                await SendAsync(connection, "pong", new { at = DateTime.UtcNow }, cancellationToken);
                return;
            }

            if (type.Equals("join-room", StringComparison.OrdinalIgnoreCase))
            {
                var payload = document.RootElement.GetProperty("payload");
                var roomId = payload.GetProperty("roomId").GetString() ?? string.Empty;
                var name = payload.TryGetProperty("name", out var nameProp) ? nameProp.GetString() : connection.DisplayName;
                var requestedRole = payload.TryGetProperty("role", out var roleProp) ? roleProp.GetString() : "player";

                if (!_rooms.TryGetValue(roomId, out var room))
                {
                    await SendAsync(connection, "error", new { message = "Mã PIN không tồn tại." }, cancellationToken);
                    return;
                }

                connection.RoomId = roomId;

                if (requestedRole == "host" && (connection.IsAdmin || connection.Role == "Admin"))
                {
                    room.HostConnectionId = connection.ConnectionId;
                    await SendAsync(connection, "room-state", GetRoomStateForHost(room), cancellationToken);
                }
                else
                {
                    var player = new ArenaPlayer
                    {
                        ConnectionId = connection.ConnectionId,
                        Name = name ?? "Học sinh ẩn danh",
                        Score = 0
                    };
                    room.Players[connection.ConnectionId] = player;

                    // Notify host about new player
                    await BroadcastToRoomAsync(roomId, "player-joined", new
                    {
                        player,
                        players = GetSanitizedPlayers(room)
                    });

                    // Send room state to newly joined player
                    await SendAsync(connection, "room-state", GetRoomStateForPlayer(room, connection.ConnectionId), cancellationToken);
                }
                return;
            }

            // All other actions require being in a room
            if (string.IsNullOrEmpty(connection.RoomId) || !_rooms.TryGetValue(connection.RoomId, out var activeRoom))
            {
                return;
            }

            if (type.Equals("start-question", StringComparison.OrdinalIgnoreCase) || type.Equals("next-question", StringComparison.OrdinalIgnoreCase))
            {
                if (connection.ConnectionId != activeRoom.HostConnectionId) return;

                if (activeRoom.CurrentQuestionIndex + 1 >= activeRoom.Questions.Count)
                {
                    await BroadcastToRoomAsync(connection.RoomId, "game-over", new
                    {
                        leaderboard = GetLeaderboard(activeRoom)
                    }, cancellationToken);
                    return;
                }

                activeRoom.CurrentQuestionIndex++;
                activeRoom.QuestionStartTime = DateTime.UtcNow;
                activeRoom.ShowAnswers = false;

                // Reset player responses for new question
                foreach (var player in activeRoom.Players.Values)
                {
                    player.HasAnswered = false;
                    player.SelectedAnswerId = null;
                    player.ScoreDelta = 0;
                    player.LastAnswerCorrect = null;
                }

                // Broadcast question to players (without showing correct answers)
                await BroadcastRoomStateToEveryone(activeRoom, cancellationToken);
                return;
            }

            if (type.Equals("submit-answer", StringComparison.OrdinalIgnoreCase))
            {
                if (!activeRoom.Players.TryGetValue(connection.ConnectionId, out var player)) return;
                if (activeRoom.CurrentQuestionIndex < 0 || activeRoom.CurrentQuestionIndex >= activeRoom.Questions.Count) return;
                if (player.HasAnswered || activeRoom.ShowAnswers) return;

                var payload = document.RootElement.GetProperty("payload");
                var answerId = payload.GetProperty("answerId").GetString();

                var currentQuestion = activeRoom.Questions[activeRoom.CurrentQuestionIndex];
                var selectedAnswer = currentQuestion.Answers.FirstOrDefault(a => a.Id == answerId);

                player.HasAnswered = true;
                player.SelectedAnswerId = answerId;

                if (selectedAnswer != null && selectedAnswer.IsCorrect)
                {
                    var baseScore = currentQuestion.Score > 0 ? currentQuestion.Score : 1000;
                    var timeTakenSec = activeRoom.QuestionStartTime.HasValue 
                        ? (DateTime.UtcNow - activeRoom.QuestionStartTime.Value).TotalSeconds 
                        : 0;
                    var totalTimeSec = 20.0;
                    double multiplier = 1.0;
                    if (timeTakenSec < totalTimeSec)
                    {
                        multiplier = 1.0 - (timeTakenSec / totalTimeSec) * 0.5;
                    }
                    else
                    {
                        multiplier = 0.5;
                    }

                    var points = (int)Math.Round(baseScore * (decimal)multiplier);
                    player.ScoreDelta = points;
                    player.Score += points;
                    player.LastAnswerCorrect = true;
                }
                else
                {
                    player.ScoreDelta = 0;
                    player.LastAnswerCorrect = false;
                }

                // Notify host that player answered
                var answeredCount = activeRoom.Players.Values.Count(p => p.HasAnswered);
                var totalPlayers = activeRoom.Players.Count;

                await SendToConnectionIdAsync(activeRoom.HostConnectionId, "player-answered", new
                {
                    connectionId = connection.ConnectionId,
                    playerName = player.Name,
                    answeredCount,
                    totalPlayers
                }, cancellationToken);

                // Send immediate answer confirmation to player
                await SendAsync(connection, "answer-submitted", new
                {
                    hasAnswered = true,
                    selectedAnswerId = answerId
                }, cancellationToken);

                // Auto end question if all players answered
                if (answeredCount == totalPlayers && totalPlayers > 0)
                {
                    await EndQuestionAsync(activeRoom, cancellationToken);
                }
                return;
            }

            if (type.Equals("show-results", StringComparison.OrdinalIgnoreCase))
            {
                if (connection.ConnectionId != activeRoom.HostConnectionId) return;
                await EndQuestionAsync(activeRoom, cancellationToken);
                return;
            }

            if (type.Equals("show-leaderboard", StringComparison.OrdinalIgnoreCase))
            {
                if (connection.ConnectionId != activeRoom.HostConnectionId) return;
                await BroadcastToRoomAsync(activeRoom.RoomId, "leaderboard", new
                {
                    leaderboard = GetLeaderboard(activeRoom)
                }, cancellationToken);
            }
        }

        private async Task EndQuestionAsync(ArenaRoom room, CancellationToken cancellationToken)
        {
            room.ShowAnswers = true;
            await BroadcastRoomStateToEveryone(room, cancellationToken);
        }

        private async Task BroadcastRoomStateToEveryone(ArenaRoom room, CancellationToken cancellationToken)
        {
            // Send to Host
            if (!string.IsNullOrEmpty(room.HostConnectionId))
            {
                await SendToConnectionIdAsync(room.HostConnectionId, "room-state", GetRoomStateForHost(room), cancellationToken);
            }

            // Send custom tailored state to each player
            foreach (var playerConnId in room.Players.Keys)
            {
                await SendToConnectionIdAsync(playerConnId, "room-state", GetRoomStateForPlayer(room, playerConnId), cancellationToken);
            }
        }

        private object GetRoomStateForHost(ArenaRoom room)
        {
            var currentQuestion = room.CurrentQuestionIndex >= 0 && room.CurrentQuestionIndex < room.Questions.Count
                ? room.Questions[room.CurrentQuestionIndex]
                : null;

            return new
            {
                roomId = room.RoomId,
                testId = room.TestId,
                testName = room.TestName,
                currentQuestionIndex = room.CurrentQuestionIndex,
                totalQuestions = room.Questions.Count,
                showAnswers = room.ShowAnswers,
                players = GetSanitizedPlayers(room),
                currentQuestion = currentQuestion == null ? null : new
                {
                    id = currentQuestion.Id,
                    content = currentQuestion.Content,
                    score = currentQuestion.Score,
                    orderIndex = currentQuestion.OrderIndex,
                    answers = currentQuestion.Answers.Select(a => new
                    {
                        id = a.Id,
                        content = a.Content,
                        isCorrect = a.IsCorrect,
                        orderIndex = a.OrderIndex
                    }).ToList()
                },
                answeredCount = room.Players.Values.Count(p => p.HasAnswered),
                totalPlayers = room.Players.Count,
                leaderboard = GetLeaderboard(room)
            };
        }

        private object GetRoomStateForPlayer(ArenaRoom room, string playerConnectionId)
        {
            var currentQuestion = room.CurrentQuestionIndex >= 0 && room.CurrentQuestionIndex < room.Questions.Count
                ? room.Questions[room.CurrentQuestionIndex]
                : null;

            room.Players.TryGetValue(playerConnectionId, out var currentPlayer);

            return new
            {
                roomId = room.RoomId,
                currentQuestionIndex = room.CurrentQuestionIndex,
                totalQuestions = room.Questions.Count,
                showAnswers = room.ShowAnswers,
                currentPlayer = currentPlayer == null ? null : new
                {
                    name = currentPlayer.Name,
                    score = currentPlayer.Score,
                    hasAnswered = currentPlayer.HasAnswered,
                    selectedAnswerId = currentPlayer.SelectedAnswerId,
                    scoreDelta = currentPlayer.ScoreDelta,
                    lastAnswerCorrect = currentPlayer.LastAnswerCorrect
                },
                currentQuestion = currentQuestion == null ? null : new
                {
                    id = currentQuestion.Id,
                    content = currentQuestion.Content,
                    score = currentQuestion.Score,
                    orderIndex = currentQuestion.OrderIndex,
                    // Hide correctness until teacher triggers "Show Answers"
                    answers = currentQuestion.Answers.Select(a => new
                    {
                        id = a.Id,
                        content = a.Content,
                        orderIndex = a.OrderIndex,
                        isCorrect = room.ShowAnswers ? a.IsCorrect : (bool?)null
                    }).ToList()
                },
                leaderboard = room.ShowAnswers ? GetLeaderboard(room) : null
            };
        }

        private List<object> GetSanitizedPlayers(ArenaRoom room)
        {
            return room.Players.Values
                .Select(p => (object)new
                {
                    connectionId = p.ConnectionId,
                    name = p.Name,
                    score = p.Score,
                    hasAnswered = p.HasAnswered
                })
                .ToList();
        }

        private List<object> GetLeaderboard(ArenaRoom room)
        {
            return room.Players.Values
                .OrderByDescending(p => p.Score)
                .Select((p, idx) => (object)new
                {
                    rank = idx + 1,
                    name = p.Name,
                    score = p.Score,
                    scoreDelta = p.ScoreDelta,
                    lastAnswerCorrect = p.LastAnswerCorrect
                })
                .ToList();
        }

        private async Task SendToConnectionIdAsync(
            string connectionId,
            string eventType,
            object? payload,
            CancellationToken cancellationToken = default)
        {
            if (_connections.TryGetValue(connectionId, out var connection))
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
            var connections = _connections.Values.Where(x => string.Equals(x.RoomId, roomId, StringComparison.Ordinal));
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
                await HandleDisconnectAsync(_connections[connId]);
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
    }
}
