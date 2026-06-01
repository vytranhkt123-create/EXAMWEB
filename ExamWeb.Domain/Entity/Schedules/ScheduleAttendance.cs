using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.Schedules
{
    public static class ScheduleAttendanceStatuses
    {
        public const string Present = "Present";
        public const string Absent = "Absent";
        public const string Late = "Late";

        public static string Normalize(string status)
        {
            if (string.Equals(status, Present, StringComparison.OrdinalIgnoreCase)) return Present;
            if (string.Equals(status, Absent, StringComparison.OrdinalIgnoreCase)) return Absent;
            if (string.Equals(status, Late, StringComparison.OrdinalIgnoreCase)) return Late;
            throw new DomainException("Trạng thái điểm danh không hợp lệ");
        }
    }

    public class ScheduleAttendance
    {
        protected ScheduleAttendance() { }

        public string Id { get; private set; } = string.Empty;
        public string ScheduleId { get; private set; } = string.Empty;
        public int AccountId { get; private set; }
        public string Status { get; private set; } = string.Empty;
        public string? Reason { get; private set; }
        public DateTime UpdatedAt { get; private set; }

        public ClassSchedule Schedule { get; private set; } = null!;

        public ScheduleAttendance(string scheduleId, int accountId, string status, string? reason)
        {
            Id = "Attendance_" + Guid.NewGuid().ToString("N");
            ChangeScheduleId(scheduleId);
            ChangeAccountId(accountId);
            Update(status, reason);
        }

        public void Update(string status, string? reason)
        {
            Status = ScheduleAttendanceStatuses.Normalize(status);
            Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();

            if ((Status == ScheduleAttendanceStatuses.Absent || Status == ScheduleAttendanceStatuses.Late) &&
                string.IsNullOrWhiteSpace(Reason))
            {
                throw new DomainException("Vui lòng nhập lý do vắng hoặc đi muộn");
            }

            UpdatedAt = DateTime.UtcNow;
        }

        private void ChangeScheduleId(string scheduleId)
        {
            if (string.IsNullOrWhiteSpace(scheduleId))
            {
                throw new DomainException("Lịch học không hợp lệ");
            }

            ScheduleId = scheduleId.Trim();
        }

        private void ChangeAccountId(int accountId)
        {
            if (accountId <= 0)
            {
                throw new DomainException("Tài khoản điểm danh không hợp lệ");
            }

            AccountId = accountId;
        }
    }
}
