namespace ExamWeb.Application.DTO.Arenas
{
    public class ArenaListDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string TestId { get; set; } = string.Empty;
        public string TestName { get; set; } = string.Empty;
        public DateTime? ScheduledStartTime { get; set; }
        public int DurationMinutes { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? EndedAt { get; set; }
        public int CreatedBy { get; set; }
    }

    public class ArenaDetailDto : ArenaListDto
    {
        public List<ArenaQuestionDto> Questions { get; set; } = new();
    }

    public class ArenaQuestionDto
    {
        public string Id { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public decimal Score { get; set; }
        public int OrderIndex { get; set; }
        public List<ArenaAnswerDto> Answers { get; set; } = new();
    }

    public class ArenaAnswerDto
    {
        public string Id { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public bool IsCorrect { get; set; }
        public int OrderIndex { get; set; }
    }

    public class CreateArenaResponse
    {
        public string ArenaId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string TestId { get; set; } = string.Empty;
        public string TestName { get; set; } = string.Empty;
        public int QuestionCount { get; set; }
    }
}
