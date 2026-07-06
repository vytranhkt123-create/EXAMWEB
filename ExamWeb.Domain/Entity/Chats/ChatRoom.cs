using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.Chats
{
    public class ChatRoom
    {
        protected ChatRoom() { }

        public string Id { get; private set; } = string.Empty;
        public ChatRoomType Type { get; private set; }
        public string Title { get; private set; } = string.Empty;
        public string? ScopeId { get; private set; }
        public string? DirectKey { get; private set; }
        public int CreatedByAccountId { get; private set; }
        public DateTime CreatedAt { get; private set; }
        public DateTime? UpdatedAt { get; private set; }
        public DateTime? LastMessageAt { get; private set; }

        public ICollection<ChatRoomParticipant> Participants { get; private set; } = new List<ChatRoomParticipant>();
        public ICollection<ChatMessage> Messages { get; private set; } = new List<ChatMessage>();

        public ChatRoom(
            ChatRoomType type,
            string title,
            int createdByAccountId,
            string? scopeId = null,
            string? directKey = null)
        {
            if (createdByAccountId <= 0)
            {
                throw new DomainException("Creator account is invalid");
            }

            Id = "ChatRoom_" + Guid.NewGuid().ToString("N");
            Type = type;
            CreatedByAccountId = createdByAccountId;
            CreatedAt = DateTime.UtcNow;
            ChangeTitle(title);

            if (type == ChatRoomType.Direct)
            {
                if (string.IsNullOrWhiteSpace(directKey))
                {
                    throw new DomainException("Direct chat key is required");
                }

                DirectKey = directKey.Trim();
                ScopeId = null;
            }
            else
            {
                if (string.IsNullOrWhiteSpace(scopeId))
                {
                    throw new DomainException("Scoped chat id is required");
                }

                ScopeId = scopeId.Trim();
                DirectKey = null;
            }
        }

        public void ChangeTitle(string title)
        {
            if (string.IsNullOrWhiteSpace(title))
            {
                throw new DomainException("Chat room title is required");
            }

            Title = title.Trim();
            UpdatedAt = DateTime.UtcNow;
        }

        public void TouchLastMessage()
        {
            LastMessageAt = DateTime.UtcNow;
            UpdatedAt = LastMessageAt;
        }
    }
}
