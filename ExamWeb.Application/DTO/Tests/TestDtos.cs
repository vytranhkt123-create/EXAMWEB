namespace ExamWeb.Application.DTO.Tests
{
    public class TestListDto
    {
        public string Id { get; set; } = string.Empty;
        public string TestName { get; set; } = string.Empty;
        public int DurationMinutes { get; set; }
        public int QuestionCount { get; set; }
        public decimal ScoreTotal { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class TestDetailDto : TestListDto
    {
        public List<int> AssignedStudentIds { get; set; } = new();
        public List<QuestionDto> Questions { get; set; } = new();
    }

    public class QuestionDto
    {
        public string Id { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public decimal Score { get; set; }
        public List<AnswerDto> Answers { get; set; } = new();
    }

    public class AnswerDto
    {
        public string Id { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public bool IsCorrect { get; set; }
    }

    public class TestTakeDto
    {
        public string Id { get; set; } = string.Empty;
        public string TestName { get; set; } = string.Empty;
        public int DurationMinutes { get; set; }
        public int QuestionCount { get; set; }
        public decimal ScoreTotal { get; set; }
        public List<QuestionTakeDto> Questions { get; set; } = new();
    }

    public class QuestionTakeDto
    {
        public string Id { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public decimal Score { get; set; }
        public List<AnswerOptionDto> Answers { get; set; } = new();
    }

    public class AnswerOptionDto
    {
        public string Id { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }

    public class SubmitTestResponse
    {
        public string TestId { get; set; } = string.Empty;
        public string? MonitoringSessionId { get; set; }
        public string StudentName { get; set; } = string.Empty;
        public decimal Score { get; set; }
        public decimal ScoreTotal { get; set; }
        public int CorrectCount { get; set; }
        public int QuestionCount { get; set; }
        public int? DurationSeconds { get; set; }
        public bool IsTimeExpired { get; set; }
        public DateTime SubmittedAt { get; set; }
        public List<SubmitQuestionResultDto> Results { get; set; } = new();
    }

    public class SubmitQuestionResultDto
    {
        public string QuestionId { get; set; } = string.Empty;
        public string QuestionContent { get; set; } = string.Empty;
        public string? SelectedAnswerId { get; set; }
        public string? CorrectAnswerId { get; set; }
        public bool IsCorrect { get; set; }
        public decimal ScoreEarned { get; set; }
    }

    public class ExamAttemptDto
    {
        public string Id { get; set; } = string.Empty;
        public string TestId { get; set; } = string.Empty;
        public int? AccountId { get; set; }
        public string? MonitoringSessionId { get; set; }
        public string TestName { get; set; } = string.Empty;
        public string StudentName { get; set; } = string.Empty;
        public string? Grade { get; set; }
        public string? ClassName { get; set; }
        public decimal Score { get; set; }
        public decimal ScoreTotal { get; set; }
        public int CorrectCount { get; set; }
        public int QuestionCount { get; set; }
        public int? DurationSeconds { get; set; }
        public bool IsTimeExpired { get; set; }
        public DateTime SubmittedAt { get; set; }
    }

    public class ScreenMonitorEventDto
    {
        public string Id { get; set; } = string.Empty;
        public string TestId { get; set; } = string.Empty;
        public string TestName { get; set; } = string.Empty;
        public string SessionId { get; set; } = string.Empty;
        public string StudentName { get; set; } = string.Empty;
        public string EventType { get; set; } = string.Empty;
        public string? Message { get; set; }
        public string? ImageDataUrl { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    public class ScreenMonitorSessionDto
    {
        public string TestId { get; set; } = string.Empty;
        public string TestName { get; set; } = string.Empty;
        public string SessionId { get; set; } = string.Empty;
        public string StudentName { get; set; } = string.Empty;
        public string LastEventType { get; set; } = string.Empty;
        public string? LastMessage { get; set; }
        public string? LastImageDataUrl { get; set; }
        public DateTime LastSeenAt { get; set; }
        public int EventCount { get; set; }
        public bool IsActive { get; set; }
        public List<ScreenMonitorEventDto> Events { get; set; } = new();
    }
}
