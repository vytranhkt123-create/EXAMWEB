namespace ExamWeb.Application.DTO.Tests
{
    public class CreateTestRequest
    {
        public string TestName { get; set; } = string.Empty;
        public string? ClassRoomId { get; set; }
        public int DurationMinutes { get; set; } = 30;
        public bool AllowPracticeMode { get; set; } = true;
        public List<int> AssignedStudentIds { get; set; } = new();
    }

    public class UpdateTestRequest
    {
        public string TestName { get; set; } = string.Empty;
        public string? ClassRoomId { get; set; }
        public int DurationMinutes { get; set; } = 30;
        public bool AllowPracticeMode { get; set; } = true;
        public List<int> AssignedStudentIds { get; set; } = new();
    }

    public class SaveQuestionRequest
    {
        public string Content { get; set; } = string.Empty;
        public string QuestionType { get; set; } = "MultipleChoice";
        public string? ImageUrl { get; set; }
        public decimal Score { get; set; } = 1;
        public List<SaveAnswerRequest> Answers { get; set; } = new();
    }

    public class SaveAnswerRequest
    {
        public string Content { get; set; } = string.Empty;
        public bool IsCorrect { get; set; }
    }

    public class SubmitTestRequest
    {
        public string? MonitoringSessionId { get; set; }
        public int? DurationSeconds { get; set; }
        public bool IsTimeExpired { get; set; }
        public List<SubmitAnswerRequest> Answers { get; set; } = new();
    }

    public class SubmitAnswerRequest
    {
        public string QuestionId { get; set; } = string.Empty;
        public string? AnswerId { get; set; }
        public string? AnswerText { get; set; }
    }

    public class ScreenMonitorEventRequest
    {
        public string SessionId { get; set; } = string.Empty;
        public string EventType { get; set; } = string.Empty;
        public string? Message { get; set; }
        public string? ImageDataUrl { get; set; }
    }

    public class ExplainQuestionRequest
    {
        public string SelectedAnswerId { get; set; } = string.Empty;
    }
}
