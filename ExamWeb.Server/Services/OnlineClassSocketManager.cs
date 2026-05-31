using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using ExamWeb.Application.IService;

namespace ExamWeb.Server.Services
{
    public class OnlineClassSocketManager : IOnlineClassRealtimeNotifier
    {
        private readonly ConcurrentDictionary<string, OnlineClassSocketConnection> _connections = new();
        private readonly JsonSerializerOptions _jsonOptions = new(JsonSerializerDefaults.Web);

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
            var connection = new OnlineClassSocketConnection(
                "Peer_" + Guid.NewGuid().ToString("N"),
                webSocket,
                context.User.FindFirstValue(ClaimTypes.NameIdentifier),
                context.User.FindFirstValue(ClaimTypes.Name) ?? context.User.FindFirstValue("username") ?? "Người dùng",
                context.User.FindFirstValue(ClaimTypes.Role) ?? context.User.FindFirstValue("role") ?? "User");

            var peers = _connections.Values
                .Where(x => x.IsInMeeting)
                .Select(CreatePeerPayload)
                .ToList();

            _connections[connection.ConnectionId] = connection;

            await SendAsync(connection, "connected", new
            {
                connectionId = connection.ConnectionId,
                peers
            });

            try
            {
                await ReceiveLoopAsync(connection);
            }
            finally
            {
                _connections.TryRemove(connection.ConnectionId, out _);
                if (connection.IsInMeeting)
                {
                    await BroadcastToMeetingAsync("peer-left", new { connectionId = connection.ConnectionId });
                }
            }
        }

        public Task BroadcastAsync(string eventType, object? payload, CancellationToken cancellationToken = default)
        {
            return BroadcastAsync(eventType, payload, exceptConnectionId: null, cancellationToken);
        }

        private async Task ReceiveLoopAsync(OnlineClassSocketConnection connection)
        {
            var buffer = new byte[64 * 1024];

            while (connection.Socket.State == WebSocketState.Open)
            {
                var builder = new StringBuilder();
                WebSocketReceiveResult result;

                do
                {
                    result = await connection.Socket.ReceiveAsync(buffer, CancellationToken.None);
                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await connection.Socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "closed", CancellationToken.None);
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

                if (type == "ping")
                {
                    await SendAsync(connection, "pong", new { at = DateTime.UtcNow });
                    return;
                }

                if (type == "join-room")
                {
                    await JoinMeetingAsync(connection);
                    return;
                }

                if (type == "leave-room")
                {
                    await LeaveMeetingAsync(connection);
                    return;
                }

                if (!document.RootElement.TryGetProperty("targetConnectionId", out var targetElement))
                {
                    return;
                }

                var targetConnectionId = targetElement.GetString();
                if (string.IsNullOrWhiteSpace(targetConnectionId) ||
                    !_connections.TryGetValue(targetConnectionId, out var target))
                {
                    return;
                }

                object? payload = null;
                if (document.RootElement.TryGetProperty("payload", out var payloadElement))
                {
                    payload = payloadElement.Clone();
                }

                await SendAsync(target, type, new
                {
                    fromConnectionId = connection.ConnectionId,
                    fromDisplayName = connection.DisplayName,
                    fromRole = connection.Role,
                    payload
                });
            }
        }

        private async Task JoinMeetingAsync(OnlineClassSocketConnection connection)
        {
            var wasInMeeting = connection.IsInMeeting;
            var peers = _connections.Values
                .Where(x => x.IsInMeeting && x.ConnectionId != connection.ConnectionId)
                .Select(CreatePeerPayload)
                .ToList();

            connection.IsInMeeting = true;

            await SendAsync(connection, "meeting-peers", new { peers });

            if (!wasInMeeting)
            {
                await BroadcastToMeetingAsync(
                    "peer-joined",
                    CreatePeerPayload(connection),
                    exceptConnectionId: connection.ConnectionId);
            }
        }

        private async Task LeaveMeetingAsync(OnlineClassSocketConnection connection)
        {
            if (!connection.IsInMeeting)
            {
                return;
            }

            connection.IsInMeeting = false;
            await BroadcastToMeetingAsync("peer-left", new { connectionId = connection.ConnectionId });
        }

        private async Task BroadcastAsync(
            string eventType,
            object? payload,
            string? exceptConnectionId,
            CancellationToken cancellationToken = default)
        {
            await SendToConnectionsAsync(
                _connections.Values.Where(x => x.ConnectionId != exceptConnectionId),
                eventType,
                payload,
                cancellationToken);
        }

        private Task BroadcastToMeetingAsync(
            string eventType,
            object? payload,
            string? exceptConnectionId = null,
            CancellationToken cancellationToken = default)
        {
            return SendToConnectionsAsync(
                _connections.Values.Where(x => x.IsInMeeting && x.ConnectionId != exceptConnectionId),
                eventType,
                payload,
                cancellationToken);
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
                role = connection.Role
            };
        }

        private sealed class OnlineClassSocketConnection
        {
            public OnlineClassSocketConnection(
                string connectionId,
                WebSocket socket,
                string? accountId,
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
            public string? AccountId { get; }
            public string DisplayName { get; }
            public string Role { get; }
            public bool IsInMeeting { get; set; }
            public SemaphoreSlim SendLock { get; } = new(1, 1);
        }
    }
}
