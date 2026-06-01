using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.OnlineClasses
{
    public class OnlineChatMessage
    {
        protected OnlineChatMessage() { }

        public string Id { get; private set; } = string.Empty;
        public string Text { get; private set; } = string.Empty;
        public int? AuthorAccountId { get; private set; }
        public string AuthorName { get; private set; } = string.Empty;
        public string Role { get; private set; } = string.Empty;
        public string? RoomId { get; private set; }
        public DateTime CreatedAt { get; private set; }

        public OnlineChatMessage(string text, int? authorAccountId, string authorName, string role, string? roomId = null)
        {
            Id = "Chat_" + Guid.NewGuid().ToString("N");
            ChangeText(text);
            AuthorAccountId = authorAccountId;
            AuthorName = string.IsNullOrWhiteSpace(authorName) ? "Người dùng" : authorName.Trim();
            Role = string.IsNullOrWhiteSpace(role) ? "User" : role.Trim();
            RoomId = string.IsNullOrWhiteSpace(roomId) ? null : roomId.Trim();
            CreatedAt = DateTime.UtcNow;
        }

        private void ChangeText(string text)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                throw new DomainException("Tin nhắn không được bỏ trống");
            }

            Text = text.Trim();
        }
    }
}
