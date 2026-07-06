using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.Chats
{
    public class ChatRoomParticipant
    {
        protected ChatRoomParticipant() { }

        public string RoomId { get; private set; } = string.Empty;
        public int AccountId { get; private set; }
        public DateTime JoinedAt { get; private set; }
        public DateTime? LastSeenAt { get; private set; }

        public ChatRoom Room { get; private set; } = null!;

        public ChatRoomParticipant(string roomId, int accountId)
        {
            if (string.IsNullOrWhiteSpace(roomId))
            {
                throw new DomainException("Chat room is invalid");
            }

            if (accountId <= 0)
            {
                throw new DomainException("Participant account is invalid");
            }

            RoomId = roomId;
            AccountId = accountId;
            JoinedAt = DateTime.UtcNow;
        }

        public void MarkSeen(DateTime seenAt)
        {
            LastSeenAt = seenAt;
        }
    }
}
