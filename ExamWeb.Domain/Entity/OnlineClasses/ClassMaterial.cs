using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.OnlineClasses
{
    public class ClassMaterial
    {
        protected ClassMaterial() { }

        public string Id { get; private set; } = string.Empty;
        public string Title { get; private set; } = string.Empty;
        public string? Description { get; private set; }
        public string FileName { get; private set; } = string.Empty;
        public string ContentType { get; private set; } = string.Empty;
        public long FileSize { get; private set; }
        public byte[] Content { get; private set; } = Array.Empty<byte>();
        public int? CreatedByAccountId { get; private set; }
        public string CreatedByName { get; private set; } = string.Empty;
        public DateTime CreatedAt { get; private set; }

        public ClassMaterial(
            string title,
            string? description,
            string fileName,
            string contentType,
            byte[] content,
            int? createdByAccountId,
            string createdByName)
        {
            Id = "Material_" + Guid.NewGuid().ToString("N");
            ChangeTitle(title);
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
            ChangeFile(fileName, contentType, content);
            CreatedByAccountId = createdByAccountId;
            CreatedByName = string.IsNullOrWhiteSpace(createdByName) ? "Admin" : createdByName.Trim();
            CreatedAt = DateTime.UtcNow;
        }

        private void ChangeTitle(string title)
        {
            if (string.IsNullOrWhiteSpace(title))
            {
                throw new DomainException("Tên tài liệu không được bỏ trống");
            }

            Title = title.Trim();
        }

        private void ChangeFile(string fileName, string contentType, byte[] content)
        {
            if (string.IsNullOrWhiteSpace(fileName))
            {
                throw new DomainException("Tên tệp không được bỏ trống");
            }

            if (content.Length == 0)
            {
                throw new DomainException("Tệp PDF không có dữ liệu");
            }

            FileName = fileName.Trim();
            ContentType = string.IsNullOrWhiteSpace(contentType) ? "application/pdf" : contentType.Trim();
            Content = content;
            FileSize = content.Length;
        }
    }
}
