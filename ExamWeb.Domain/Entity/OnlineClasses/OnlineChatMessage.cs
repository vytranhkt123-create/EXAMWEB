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
        public string? ImageDataUrl { get; private set; }
        public DateTime CreatedAt { get; private set; }

        public OnlineChatMessage(
            string? text,
            int? authorAccountId,
            string authorName,
            string role,
            string? roomId = null,
            string? imageDataUrl = null)
        {
            Id = "Chat_" + Guid.NewGuid().ToString("N");
            ChangeContent(text, imageDataUrl);
            AuthorAccountId = authorAccountId;
            AuthorName = string.IsNullOrWhiteSpace(authorName) ? "Người dùng" : authorName.Trim();
            Role = string.IsNullOrWhiteSpace(role) ? "User" : role.Trim();
            RoomId = string.IsNullOrWhiteSpace(roomId) ? null : roomId.Trim();
            CreatedAt = DateTime.UtcNow;
        }

        private void ChangeContent(string? text, string? imageDataUrl)
        {
            var cleanText = string.IsNullOrWhiteSpace(text) ? string.Empty : text.Trim();
            var cleanImageDataUrl = string.IsNullOrWhiteSpace(imageDataUrl) ? null : imageDataUrl.Trim();

            if (string.IsNullOrWhiteSpace(cleanText) && string.IsNullOrWhiteSpace(cleanImageDataUrl))
            {
                throw new DomainException("Tin nhắn hoặc hình ảnh không được bỏ trống");
            }

            Text = cleanText;
            ImageDataUrl = cleanImageDataUrl;
        }
    }
}
