using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using ExamWeb.Application.IService;
using ExamWeb.Domain.Entity.ExamMonitorEvents;
using ExamWeb.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ExamWeb.Server.Services
{
    public class OnlineClassSocketManager : IOnlineClassRealtimeNotifier
    {
        private const string ExamMonitorRoomPrefix = "exam-monitor:";
        private const int MaxInboundMessageBytes = 1024 * 1024;

        private static readonly HashSet<string> SignalingMessageTypes = new(StringComparer.OrdinalIgnoreCase)
        {
            "offer",
            "answer",
            "ice-candidate",
        };

        private readonly ConcurrentDictionary<string, OnlineClassSocketConnection> _connections = new();
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);

        public OnlineClassSocketManager(IServiceScopeFactory scopeFactory)
        {
            _scopeFactory = scopeFactory;
        }

        public async Task HandleConnectionAsync(HttpContext context)
        {
            if (context.User.Identity?.IsAuthenticated != true)
            {
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return;
            }

            if (!context.WebSockets.IsWebSocketRequest)
            {
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                return;
            }

            using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
            var accountIdClaim = context.User.FindFirstValue(ClaimTypes.NameIdentifier);
            int? accountId = int.TryParse(accountIdClaim, out var parsedAccountId) ? parsedAccountId : null;

            var connection = new OnlineClassSocketConnection(
                "Peer_" + Guid.NewGuid().ToString("N"),
                webSocket,
                accountId,
                context.User.FindFirstValue(ClaimTypes.Name) ?? context.User.FindFirstValue("username") ?? "Người dùng",
                context.User.FindFirstValue(ClaimTypes.Role) ?? context.User.FindFirstValue("role") ?? "User");

            _connections[connection.ConnectionId] = connection;

            await SendAsync(connection, "connected", new
            {
                connectionId = connection.ConnectionId,
                peers = Array.Empty<object>()
            });

            try
            {
                await ReceiveLoopAsync(connection);
            }
            finally
            {
                _connections.TryRemove(connection.ConnectionId, out _);
                if (connection.IsInMeeting && !string.IsNullOrWhiteSpace(connection.RoomId))
                {
                    await BroadcastToRoomMeetingAsync(
                        connection.RoomId,
                        "peer-left",
                        new { connectionId = connection.ConnectionId });
                }
            }
        }

        public Task BroadcastAsync(string eventType, object? payload, CancellationToken cancellationToken = default)
        {
            return BroadcastAsync(eventType, payload, roomId: null, exceptConnectionId: null, cancellationToken);
        }

        public Task BroadcastToRoomAsync(
            string roomId,
            string eventType,
            object? payload,
            CancellationToken cancellationToken = default)
        {
            return BroadcastAsync(eventType, payload, roomId, exceptConnectionId: null, cancellationToken);
        }

        private async Task ReceiveLoopAsync(OnlineClassSocketConnection connection)
        {
            var buffer = new byte[64 * 1024];

            while (connection.Socket.State == WebSocketState.Open)
            {
                var builder = new StringBuilder();
                var receivedBytes = 0;
                WebSocketReceiveResult result;

                do
                {
                    result = await connection.Socket.ReceiveAsync(buffer, CancellationToken.None);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await connection.Socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "closed", CancellationToken.None);
                        return;
                    }

                    receivedBytes += result.Count;
                    if (receivedBytes > MaxInboundMessageBytes)
                    {
                        await connection.Socket.CloseAsync(WebSocketCloseStatus.MessageTooBig, "message too large", CancellationToken.None);
                        return;
                    }

                    builder.Append(Encoding.UTF8.GetString(buffer, 0, result.Count));
                }
                while (!result.EndOfMessage);

                await HandleClientMessageAsync(connection, builder.ToString());
            }
        }

        private async Task HandleClientMessageAsync(OnlineClassSocketConnection connection, string rawMessage)
        {
            if (string.IsNullOrWhiteSpace(rawMessage))
            {
                return;
            }

            JsonDocument document;
            try
            {
                document = JsonDocument.Parse(rawMessage);
            }
            catch (JsonException)
            {
                return;
            }

            using (document)
            {
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
                    await SendAsync(connection, "pong", new { at = DateTime.UtcNow });
                    return;
                }

                if (type.Equals("join-room", StringComparison.OrdinalIgnoreCase))
                {
                    var roomId = ReadRoomId(document.RootElement);
                    await JoinRoomAsync(connection, roomId);
                    return;
                }

                if (type.Equals("leave-room", StringComparison.OrdinalIgnoreCase))
                {
                    await LeaveRoomAsync(connection);
                    return;
                }

                if (!connection.IsInMeeting || string.IsNullOrWhiteSpace(connection.RoomId))
                {
                    return;
                }

                if (type.Equals("exam-monitor-event", StringComparison.OrdinalIgnoreCase))
                {
                    await HandleExamMonitorEventAsync(connection, document.RootElement);
                    return;
                }

                if (type.Equals("whiteboard-draw", StringComparison.OrdinalIgnoreCase) ||
                    type.Equals("whiteboard-clear", StringComparison.OrdinalIgnoreCase))
                {
                    object? roomPayload = null;
                    if (document.RootElement.TryGetProperty("payload", out var roomPayloadElement))
                    {
                        roomPayload = roomPayloadElement.Clone();
                    }

                    await BroadcastToRoomMeetingAsync(
                        connection.RoomId,
                        type,
                        new
                        {
                            fromConnectionId = connection.ConnectionId,
                            fromDisplayName = connection.DisplayName,
                            payload = roomPayload
                        },
                        exceptConnectionId: connection.ConnectionId);
                    return;
                }

                if (SignalingMessageTypes.Contains(type))
                {
                    await RelaySignalingAsync(connection, type, document.RootElement);
                }
            }
        }

        private async Task RelaySignalingAsync(
            OnlineClassSocketConnection connection,
            string type,
            JsonElement root)
        {
            if (!root.TryGetProperty("targetConnectionId", out var targetElement))
            {
                return;
            }

            var targetConnectionId = targetElement.GetString();
            if (string.IsNullOrWhiteSpace(targetConnectionId) ||
                !_connections.TryGetValue(targetConnectionId, out var target))
            {
                return;
            }

            if (!target.IsInMeeting ||
                !string.Equals(target.RoomId, connection.RoomId, StringComparison.Ordinal))
            {
                return;
            }

            object? payload = null;
            if (root.TryGetProperty("payload", out var payloadElement))
            {
                payload = payloadElement.Clone();
            }

            await SendAsync(target, type, new
            {
                fromConnectionId = connection.ConnectionId,
                fromDisplayName = connection.DisplayName,
                fromRole = connection.Role,
                roomId = connection.RoomId,
                payload
            });
        }

        private async Task JoinRoomAsync(OnlineClassSocketConnection connection, string? roomId)
        {
            if (string.IsNullOrWhiteSpace(roomId))
            {
                await SendAsync(connection, "room-error", new { message = "roomId là bắt buộc" });
                return;
            }

            if (!await CanAccessRoomAsync(connection, roomId))
            {
                await SendAsync(connection, "room-error", new { message = "Bạn không có quyền vào phòng học này" });
                return;
            }

            if (connection.IsInMeeting &&
                !string.Equals(connection.RoomId, roomId, StringComparison.Ordinal))
            {
                await LeaveRoomAsync(connection, notifyPeers: true);
            }

            var wasInSameRoom = connection.IsInMeeting &&
                string.Equals(connection.RoomId, roomId, StringComparison.Ordinal);

            connection.RoomId = roomId;
            connection.IsInMeeting = true;

            var peers = GetRoomPeers(roomId, connection.ConnectionId);
            await SendAsync(connection, "meeting-peers", new { roomId, peers });

            if (!wasInSameRoom)
            {
                await BroadcastToRoomMeetingAsync(
                    roomId,
                    "peer-joined",
                    CreatePeerPayload(connection),
                    exceptConnectionId: connection.ConnectionId);
            }
        }

        private async Task LeaveRoomAsync(OnlineClassSocketConnection connection, bool notifyPeers = true)
        {
            if (!connection.IsInMeeting || string.IsNullOrWhiteSpace(connection.RoomId))
            {
                return;
            }

            var roomId = connection.RoomId;
            connection.IsInMeeting = false;
            connection.RoomId = null;

            if (notifyPeers)
            {
                await BroadcastToRoomMeetingAsync(roomId, "peer-left", new { connectionId = connection.ConnectionId });
            }
        }

        private List<object> GetRoomPeers(string roomId, string exceptConnectionId)
        {
            return _connections.Values
                .Where(x =>
                    x.IsInMeeting &&
                    string.Equals(x.RoomId, roomId, StringComparison.Ordinal) &&
                    x.ConnectionId != exceptConnectionId)
                .Select(CreatePeerPayload)
                .Cast<object>()
                .ToList();
        }

        private async Task<bool> CanAccessRoomAsync(OnlineClassSocketConnection connection, string roomId)
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            if (TryReadExamMonitorRoom(roomId, out var examTestId, out _))
            {
                return await CanAccessExamMonitorRoomAsync(dbContext, connection, examTestId);
            }

            var room = await dbContext.OnlineClassRooms
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == roomId);

            if (room == null)
            {
                return false;
            }

            if (connection.IsAdmin)
            {
                return true;
            }

            if (!connection.AccountId.HasValue)
            {
                return false;
            }

            return room.IsLive && await dbContext.ClassRoomMembers
                .AsNoTracking()
                .AnyAsync(x => x.RoomId == roomId && x.AccountId == connection.AccountId.Value);
        }

        private static async Task<bool> CanAccessExamMonitorRoomAsync(
            AppDbContext dbContext,
            OnlineClassSocketConnection connection,
            string testId)
        {
            if (connection.IsAdmin)
            {
                return await dbContext.Tests
                    .AsNoTracking()
                    .AnyAsync(x => x.Id == testId);
            }

            if (!connection.AccountId.HasValue)
            {
                return false;
            }

            return await dbContext.TestStudentAccesses
                .AsNoTracking()
                .AnyAsync(x => x.TestId == testId && x.AccountId == connection.AccountId.Value);
        }

        private async Task HandleExamMonitorEventAsync(OnlineClassSocketConnection connection, JsonElement root)
        {
            if (connection.IsAdmin ||
                string.IsNullOrWhiteSpace(connection.RoomId) ||
                !TryReadExamMonitorRoom(connection.RoomId, out var roomTestId, out var roomSessionId))
            {
                return;
            }

            if (!root.TryGetProperty("payload", out var payload) ||
                payload.ValueKind != JsonValueKind.Object)
            {
                return;
            }

            var testId = ReadString(payload, "testId") ?? roomTestId;
            var sessionId = ReadString(payload, "sessionId") ?? roomSessionId;
            var eventType = ReadString(payload, "eventType");
            var message = TrimToMaxLength(ReadString(payload, "message"), 300);
            var imageDataUrl = ReadString(payload, "imageDataUrl");

            if (!string.Equals(testId, roomTestId, StringComparison.Ordinal) ||
                !string.Equals(sessionId, roomSessionId, StringComparison.Ordinal) ||
                string.IsNullOrWhiteSpace(eventType))
            {
                return;
            }

            if (imageDataUrl?.Length > 500_000)
            {
                await SendAsync(connection, "exam-monitor-error", new { message = "Ảnh theo dõi quá lớn" });
                return;
            }

            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();

            if (!await CanAccessExamMonitorRoomAsync(dbContext, connection, testId))
            {
                await SendAsync(connection, "exam-monitor-error", new { message = "Bạn không có quyền theo dõi đề thi này" });
                return;
            }

            var test = await dbContext.Tests
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == testId);

            if (test == null)
            {
                return;
            }

            var studentName = connection.DisplayName;
            if (connection.AccountId.HasValue)
            {
                var account = await dbContext.Accounts
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == connection.AccountId.Value);
                if (account != null)
                {
                    studentName = account.DisplayName;
                }
            }

            var monitorEvent = new ExamMonitorEvent(
                test.Id,
                test.TestName,
                sessionId,
                studentName,
                eventType,
                message,
                imageDataUrl);

            dbContext.ExamMonitorEvents.Add(monitorEvent);
            await dbContext.SaveChangesAsync();

            var eventPayload = new
            {
                id = monitorEvent.Id,
                testId = monitorEvent.TestId,
                testName = monitorEvent.TestName,
                sessionId = monitorEvent.SessionId,
                studentName = monitorEvent.StudentName,
                eventType = monitorEvent.EventType,
                message = monitorEvent.Message,
                createdAt = monitorEvent.CreatedAt
            };

            await SendAsync(connection, "exam-monitor-event-saved", eventPayload);
            await BroadcastToAdminsAsync("exam-monitor-event-recorded", eventPayload);
        }

        private Task BroadcastAsync(
            string eventType,
            object? payload,
            string? roomId,
            string? exceptConnectionId,
            CancellationToken cancellationToken = default)
        {
            IEnumerable<OnlineClassSocketConnection> connections = _connections.Values;

            if (!string.IsNullOrWhiteSpace(roomId))
            {
                connections = connections.Where(x => string.Equals(x.RoomId, roomId, StringComparison.Ordinal));
            }

            if (!string.IsNullOrWhiteSpace(exceptConnectionId))
            {
                connections = connections.Where(x => x.ConnectionId != exceptConnectionId);
            }

            return SendToConnectionsAsync(connections, eventType, payload, cancellationToken);
        }

        private Task BroadcastToAdminsAsync(
            string eventType,
            object? payload,
            CancellationToken cancellationToken = default)
        {
            var connections = _connections.Values.Where(x => x.IsAdmin);
            return SendToConnectionsAsync(connections, eventType, payload, cancellationToken);
        }

        private Task BroadcastToRoomMeetingAsync(
            string roomId,
            string eventType,
            object? payload,
            string? exceptConnectionId = null,
            CancellationToken cancellationToken = default)
        {
            var connections = _connections.Values.Where(x =>
                x.IsInMeeting &&
                string.Equals(x.RoomId, roomId, StringComparison.Ordinal) &&
                x.ConnectionId != exceptConnectionId);

            return SendToConnectionsAsync(connections, eventType, payload, cancellationToken);
        }

        private async Task SendToConnectionsAsync(
            IEnumerable<OnlineClassSocketConnection> connections,
            string eventType,
            object? payload,
            CancellationToken cancellationToken = default)
        {
            var staleConnections = new ConcurrentBag<string>();
            var sendTasks = connections.Select(async connection =>
            {
                try
                {
                    await SendAsync(connection, eventType, payload, cancellationToken);
                }
                catch
                {
                    staleConnections.Add(connection.ConnectionId);
                }
            });

            await Task.WhenAll(sendTasks);

            foreach (var connectionId in staleConnections)
            {
                _connections.TryRemove(connectionId, out _);
            }
        }

        private async Task SendAsync(
            OnlineClassSocketConnection connection,
            string type,
            object? payload,
            CancellationToken cancellationToken = default)
        {
            if (connection.Socket.State != WebSocketState.Open)
            {
                return;
            }

            var envelope = JsonSerializer.Serialize(new
            {
                type,
                payload
            }, _jsonOptions);
            var bytes = Encoding.UTF8.GetBytes(envelope);

            await connection.SendLock.WaitAsync(cancellationToken);
            try
            {
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

        private static object CreatePeerPayload(OnlineClassSocketConnection connection)
        {
            return new
            {
                connectionId = connection.ConnectionId,
                displayName = connection.DisplayName,
                role = connection.Role,
                roomId = connection.RoomId
            };
        }

        private static string? ReadRoomId(JsonElement root)
        {
            if (root.TryGetProperty("roomId", out var roomIdElement))
            {
                return roomIdElement.GetString();
            }

            if (root.TryGetProperty("payload", out var payloadElement) &&
                payloadElement.ValueKind == JsonValueKind.Object &&
                payloadElement.TryGetProperty("roomId", out var nestedRoomId))
            {
                return nestedRoomId.GetString();
            }

            return null;
        }

        private static string? ReadString(JsonElement root, string propertyName)
        {
            if (!root.TryGetProperty(propertyName, out var element) ||
                element.ValueKind == JsonValueKind.Null ||
                element.ValueKind == JsonValueKind.Undefined)
            {
                return null;
            }

            return element.GetString();
        }

        private static string? TrimToMaxLength(string? value, int maxLength)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            var trimmed = value.Trim();
            return trimmed.Length <= maxLength ? trimmed : trimmed[..maxLength];
        }

        private static bool TryReadExamMonitorRoom(string? roomId, out string testId, out string sessionId)
        {
            testId = string.Empty;
            sessionId = string.Empty;

            if (string.IsNullOrWhiteSpace(roomId) ||
                !roomId.StartsWith(ExamMonitorRoomPrefix, StringComparison.Ordinal))
            {
                return false;
            }

            var parts = roomId[ExamMonitorRoomPrefix.Length..].Split(':', 2);
            if (parts.Length != 2 ||
                string.IsNullOrWhiteSpace(parts[0]) ||
                string.IsNullOrWhiteSpace(parts[1]))
            {
                return false;
            }

            testId = parts[0];
            sessionId = parts[1];
            return true;
        }

        private sealed class OnlineClassSocketConnection
        {
            public OnlineClassSocketConnection(
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
            public bool IsInMeeting { get; set; }
            public SemaphoreSlim SendLock { get; } = new(1, 1);
        }
    }
}
