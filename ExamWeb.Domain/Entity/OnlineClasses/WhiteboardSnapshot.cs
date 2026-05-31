using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.OnlineClasses
{
    public class WhiteboardSnapshot
    {
        protected WhiteboardSnapshot() { }

        public string Id { get; private set; } = string.Empty;
        public string Title { get; private set; } = string.Empty;
        public string DataUrl { get; private set; } = string.Empty;
        public int? AuthorAccountId { get; private set; }
        public string AuthorName { get; private set; } = string.Empty;
        public DateTime CreatedAt { get; private set; }

        public WhiteboardSnapshot(string dataUrl, int? authorAccountId, string authorName)
        {
            Id = "Board_" + Guid.NewGuid().ToString("N");
            CreatedAt = DateTime.UtcNow;
            Title = $"Bảng trắng {CreatedAt:dd/MM/yyyy HH:mm}";
            ChangeDataUrl(dataUrl);
            AuthorAccountId = authorAccountId;
            AuthorName = string.IsNullOrWhiteSpace(authorName) ? "Người dùng" : authorName.Trim();
        }

        private void ChangeDataUrl(string dataUrl)
        {
            if (string.IsNullOrWhiteSpace(dataUrl))
            {
                throw new DomainException("Dữ liệu bảng trắng không được bỏ trống");
            }

            DataUrl = dataUrl;
        }
    }
}
