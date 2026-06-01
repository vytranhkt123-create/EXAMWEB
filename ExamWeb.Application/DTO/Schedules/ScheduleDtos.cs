namespace ExamWeb.Application.DTO.Schedules
{
    public class ClassScheduleDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public int? CreatedBy { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public AttendanceSummaryDto AttendanceSummary { get; set; } = new();
        public ScheduleAttendanceDto? MyAttendance { get; set; }
    }

    public class ClassScheduleDetailDto : ClassScheduleDto
    {
        public IReadOnlyList<ScheduleAttendanceDto> Attendances { get; set; } = Array.Empty<ScheduleAttendanceDto>();
    }

    public class AttendanceSummaryDto
    {
        public int PresentCount { get; set; }
        public int AbsentCount { get; set; }
        public int LateCount { get; set; }
    }

    public class ScheduleAttendanceDto
    {
        public string Id { get; set; } = string.Empty;
        public string ScheduleId { get; set; } = string.Empty;
        public string ScheduleTitle { get; set; } = string.Empty;
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
        public int AccountId { get; set; }
        public string StudentName { get; set; } = string.Empty;
        public string? Grade { get; set; }
        public string? ClassName { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Reason { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class CreateClassScheduleRequest
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
    }

    public class UpdateClassScheduleRequest
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime StartTime { get; set; }
        public DateTime EndTime { get; set; }
    }

    public class UpsertScheduleAttendanceRequest
    {
        public string Status { get; set; } = string.Empty;
        public string? Reason { get; set; }
    }
}
