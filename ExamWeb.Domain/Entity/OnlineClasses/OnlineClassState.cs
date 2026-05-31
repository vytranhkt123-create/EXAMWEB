using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.OnlineClasses
{
    public class OnlineClassState
    {
        protected OnlineClassState() { }

        public int Id { get; private set; }
        public string Title { get; private set; } = string.Empty;
        public string Agenda { get; private set; } = string.Empty;
        public bool IsLive { get; private set; }
        public string? WhiteboardImage { get; private set; }
        public DateTime? UpdatedAt { get; private set; }
        public string? UpdatedByName { get; private set; }

        public OnlineClassState(string title, string agenda)
        {
            Id = 1;
            ChangeInfo(title, agenda, "Hệ thống");
            IsLive = false;
        }

        public void ChangeInfo(string title, string agenda, string updatedByName)
        {
            if (string.IsNullOrWhiteSpace(title))
            {
                throw new DomainException("Tên buổi học không được bỏ trống");
            }

            Title = title.Trim();
            Agenda = string.IsNullOrWhiteSpace(agenda) ? string.Empty : agenda.Trim();
            Touch(updatedByName);
        }

        public void ChangeLiveStatus(bool isLive, string updatedByName)
        {
            IsLive = isLive;
            Touch(updatedByName);
        }

        public void ChangeWhiteboardImage(string dataUrl, string updatedByName)
        {
            if (string.IsNullOrWhiteSpace(dataUrl))
            {
                throw new DomainException("Dữ liệu bảng trắng không được bỏ trống");
            }

            WhiteboardImage = dataUrl;
            Touch(updatedByName);
        }

        private void Touch(string updatedByName)
        {
            UpdatedAt = DateTime.UtcNow;
            UpdatedByName = string.IsNullOrWhiteSpace(updatedByName) ? "Hệ thống" : updatedByName.Trim();
        }
    }
}
