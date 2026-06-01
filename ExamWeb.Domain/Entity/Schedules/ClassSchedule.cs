using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.Schedules
{
    public class ClassSchedule
    {
        protected ClassSchedule() { }

        public string Id { get; private set; } = string.Empty;
        public string Title { get; private set; } = string.Empty;
        public string? Description { get; private set; }
        public DateTime StartTime { get; private set; }
        public DateTime EndTime { get; private set; }
        public int? CreatedBy { get; private set; }
        public DateTime CreatedAt { get; private set; }

        private readonly List<ScheduleAttendance> _attendances = new();
        public IReadOnlyCollection<ScheduleAttendance> Attendances => _attendances.AsReadOnly();

        public ClassSchedule(
            string title,
            string? description,
            DateTime startTime,
            DateTime endTime,
            int? createdBy)
        {
            Id = "Schedule_" + Guid.NewGuid().ToString("N");
            ChangeTitle(title);
            ChangeDescription(description);
            ChangeTimeRange(startTime, endTime);
            CreatedBy = createdBy;
            CreatedAt = DateTime.UtcNow;
        }

        public void Update(string title, string? description, DateTime startTime, DateTime endTime)
        {
            ChangeTitle(title);
            ChangeDescription(description);
            ChangeTimeRange(startTime, endTime);
        }

        private void ChangeTitle(string title)
        {
            if (string.IsNullOrWhiteSpace(title))
            {
                throw new DomainException("Tiêu đề lịch học không được bỏ trống");
            }

            Title = title.Trim();
        }

        private void ChangeDescription(string? description)
        {
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        }

        private void ChangeTimeRange(DateTime startTime, DateTime endTime)
        {
            if (endTime <= startTime)
            {
                throw new DomainException("Thời gian kết thúc phải sau thời gian bắt đầu");
            }

            StartTime = startTime;
            EndTime = endTime;
        }
    }
}
