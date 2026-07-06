using ExamWeb.Application.DTO.Chat;

namespace ExamWeb.Server.Services
{
    public class ChatPresenceTracker
    {
        private readonly object _gate = new();
        private readonly Dictionary<string, int> _connectionUsers = new();
        private readonly Dictionary<int, HashSet<string>> _userConnections = new();
        private readonly Dictionary<int, ChatPresenceDto> _onlineUsers = new();

        public (ChatPresenceDto Presence, bool BecameOnline) UserConnected(string connectionId, ChatActorDto actor)
        {
            lock (_gate)
            {
                _connectionUsers[connectionId] = actor.AccountId;
                var becameOnline = !_userConnections.TryGetValue(actor.AccountId, out var connections) || connections.Count == 0;
                if (connections == null)
                {
                    connections = new HashSet<string>();
                    _userConnections[actor.AccountId] = connections;
                }

                connections.Add(connectionId);
                var presence = new ChatPresenceDto
                {
                    AccountId = actor.AccountId,
                    DisplayName = actor.DisplayName,
                    Role = actor.Role,
                    IsOnline = true,
                    ChangedAt = DateTime.UtcNow
                };
                _onlineUsers[actor.AccountId] = presence;
                return (presence, becameOnline);
            }
        }

        public ChatPresenceDto? UserDisconnected(string connectionId)
        {
            lock (_gate)
            {
                if (!_connectionUsers.Remove(connectionId, out var accountId))
                {
                    return null;
                }

                if (!_userConnections.TryGetValue(accountId, out var connections))
                {
                    return null;
                }

                connections.Remove(connectionId);
                if (connections.Count > 0)
                {
                    return null;
                }

                _userConnections.Remove(accountId);
                if (!_onlineUsers.TryGetValue(accountId, out var previous))
                {
                    return null;
                }

                var presence = new ChatPresenceDto
                {
                    AccountId = previous.AccountId,
                    DisplayName = previous.DisplayName,
                    Role = previous.Role,
                    IsOnline = false,
                    ChangedAt = DateTime.UtcNow
                };
                _onlineUsers.Remove(accountId);
                return presence;
            }
        }

        public IReadOnlyList<ChatPresenceDto> GetOnlineUsers()
        {
            lock (_gate)
            {
                return _onlineUsers.Values
                    .OrderBy(x => x.DisplayName)
                    .ToList();
            }
        }
    }
}
