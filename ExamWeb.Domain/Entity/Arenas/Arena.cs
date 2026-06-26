using ExamWeb.Domain.DomainExceptions;
using ExamWeb.Domain.Entity.Tests;

namespace ExamWeb.Domain.Entity.Arenas
{
    public class Arena
    {
        protected Arena() { }
        
        public string Id { get; private set; } = string.Empty;
        public string Name { get; private set; } = string.Empty;
        public string? Description { get; private set; }
        public string TestId { get; private set; } = string.Empty;
        public DateTime? ScheduledStartTime { get; private set; }
        public int DurationMinutes { get; private set; } = 30;
        public bool IsActive { get; private set; } = false;
        public DateTime CreatedAt { get; private set; }
        public DateTime? EndedAt { get; private set; }
        public int CreatedByAccountId { get; private set; }

        // Navigation property
        public Test? Test { get; private set; }

        public Arena(string name, string testId, int createdByAccountId, string? description = null, DateTime? scheduledStartTime = null, int durationMinutes = 30)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new DomainException("Tên đấu trường không được để trống");
            
            if (string.IsNullOrWhiteSpace(testId))
                throw new DomainException("Đề thi không được để trống");
            
            if (durationMinutes < 1 || durationMinutes > 240)
                throw new DomainException("Thời lượng phải từ 1 đến 240 phút");

            Id = "Arena_" + Guid.NewGuid().ToString("N");
            Name = name;
            TestId = testId;
            Description = description;
            ScheduledStartTime = scheduledStartTime;
            DurationMinutes = durationMinutes;
            CreatedByAccountId = createdByAccountId;
            CreatedAt = DateTime.UtcNow;
            IsActive = false;
        }

        public void Activate()
        {
            IsActive = true;
        }

        public void Deactivate()
        {
            IsActive = false;
            EndedAt = DateTime.UtcNow;
        }

        public void UpdateInfo(string name, string? description, DateTime? scheduledStartTime, int durationMinutes)
        {
            if (string.IsNullOrWhiteSpace(name))
                throw new DomainException("Tên đấu trường không được để trống");
            
            if (durationMinutes < 1 || durationMinutes > 240)
                throw new DomainException("Thời lượng phải từ 1 đến 240 phút");

            Name = name;
            Description = description;
            ScheduledStartTime = scheduledStartTime;
            DurationMinutes = durationMinutes;
        }
    }
}
