namespace ExamWeb.Application.DTO.Arenas
{
    public class CreateArenaRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string TestId { get; set; } = string.Empty;
        public DateTime? ScheduledStartTime { get; set; }
        public int DurationMinutes { get; set; } = 30;
    }

    public class UpdateArenaRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public DateTime? ScheduledStartTime { get; set; }
        public int DurationMinutes { get; set; } = 30;
    }
}
