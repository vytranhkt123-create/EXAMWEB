using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.OnlineClasses
{
    public class ClassVideoMaterial
    {
        protected ClassVideoMaterial() { }

        public string Id { get; private set; } = string.Empty;
        public string ClassRoomId { get; private set; } = string.Empty;
        public string Title { get; private set; } = string.Empty;
        public string? Description { get; private set; }
        public string YoutubeUrl { get; private set; } = string.Empty;
        public DateTime CreatedAt { get; private set; }

        public OnlineClassRoom? ClassRoom { get; private set; }

        public ClassVideoMaterial(
            string classRoomId,
            string title,
            string? description,
            string youtubeUrl)
        {
            Id = "Video_" + Guid.NewGuid().ToString("N");
            SetClassRoom(classRoomId);
            ChangeDetails(title, description, youtubeUrl);
            CreatedAt = DateTime.UtcNow;
        }

        public void ChangeDetails(string title, string? description, string youtubeUrl)
        {
            ChangeTitle(title);
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
            ChangeYoutubeUrl(youtubeUrl);
        }

        private void SetClassRoom(string classRoomId)
        {
            if (string.IsNullOrWhiteSpace(classRoomId))
            {
                throw new DomainException("Room id is required");
            }

            ClassRoomId = classRoomId.Trim();
        }

        private void ChangeTitle(string title)
        {
            if (string.IsNullOrWhiteSpace(title))
            {
                throw new DomainException("Video title is required");
            }

            Title = title.Trim();
        }

        private void ChangeYoutubeUrl(string youtubeUrl)
        {
            if (string.IsNullOrWhiteSpace(youtubeUrl))
            {
                throw new DomainException("YouTube URL is required");
            }

            YoutubeUrl = youtubeUrl.Trim();
        }
    }
}
