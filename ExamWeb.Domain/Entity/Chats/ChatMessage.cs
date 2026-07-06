using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.Chats
{
    public class ChatMessage
    {
        private const int MaxTextLength = 2000;

        protected ChatMessage() { }

        public string Id { get; private set; } = string.Empty;
        public string RoomId { get; private set; } = string.Empty;
        public int AuthorAccountId { get; private set; }
        public string AuthorDisplayName { get; private set; } = string.Empty;
        public string AuthorRole { get; private set; } = string.Empty;
        public string Text { get; private set; } = string.Empty;
        public DateTime CreatedAt { get; private set; }
        public DateTime? EditedAt { get; private set; }
        public bool IsDeleted { get; private set; }
        public DateTime? DeletedAt { get; private set; }
        public int? DeletedByAccountId { get; private set; }

        public ChatRoom Room { get; private set; } = null!;
        public ICollection<ChatReaction> Reactions { get; private set; } = new List<ChatReaction>();
        public ICollection<ChatReadReceipt> ReadReceipts { get; private set; } = new List<ChatReadReceipt>();

        public ChatMessage(
            string roomId,
            int authorAccountId,
            string authorDisplayName,
            string authorRole,
            string text)
        {
            if (string.IsNullOrWhiteSpace(roomId))
            {
                throw new DomainException("Chat room is invalid");
            }

            if (authorAccountId <= 0)
            {
                throw new DomainException("Author account is invalid");
            }

            Id = "ChatMessage_" + Guid.NewGuid().ToString("N");
            RoomId = roomId.Trim();
            AuthorAccountId = authorAccountId;
            AuthorDisplayName = string.IsNullOrWhiteSpace(authorDisplayName)
                ? "User"
                : authorDisplayName.Trim();
            AuthorRole = string.IsNullOrWhiteSpace(authorRole) ? "User" : authorRole.Trim();
            CreatedAt = DateTime.UtcNow;
            ChangeText(text);
        }

        public void Edit(string text)
        {
            if (IsDeleted)
            {
                throw new DomainException("Deleted messages cannot be edited");
            }

            ChangeText(text);
            EditedAt = DateTime.UtcNow;
        }

        public void SoftDelete(int deletedByAccountId)
        {
            if (deletedByAccountId <= 0)
            {
                throw new DomainException("Deleting account is invalid");
            }

            IsDeleted = true;
            DeletedAt = DateTime.UtcNow;
            DeletedByAccountId = deletedByAccountId;
        }

        private void ChangeText(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                throw new DomainException("Message text is required");
            }

            var cleanText = text.Trim();
            if (cleanText.Length > MaxTextLength)
            {
                throw new DomainException($"Message text cannot exceed {MaxTextLength} characters");
            }

            Text = cleanText;
        }
    }
}
