using ExamWeb.Application.DTO.Tests;

namespace ExamWeb.Application.IService
{
    public interface ITestService
    {
        Task<IReadOnlyList<TestListDto>> GetTestsAsync(CancellationToken cancellationToken = default);
        Task<IReadOnlyList<ExamAttemptDto>> GetAttemptsAsync(string testId, CancellationToken cancellationToken = default);
        Task<IReadOnlyList<ScreenMonitorSessionDto>> GetScreenMonitorSessionsAsync(string testId, CancellationToken cancellationToken = default);
        Task<TestDetailDto?> GetTestAsync(string testId, CancellationToken cancellationToken = default);
        Task<TestTakeDto?> GetTestForTakingAsync(string testId, CancellationToken cancellationToken = default);
        Task<TestPracticeDto?> GetTestForPracticeAsync(string testId, CancellationToken cancellationToken = default);
        Task<TestDetailDto> CreateTestAsync(CreateTestRequest request, CancellationToken cancellationToken = default);
        Task<TestDetailDto?> UpdateTestAsync(string testId, UpdateTestRequest request, CancellationToken cancellationToken = default);
        Task<bool> DeleteTestAsync(string testId, CancellationToken cancellationToken = default);
        Task<QuestionDto?> AddQuestionAsync(string testId, SaveQuestionRequest request, CancellationToken cancellationToken = default);
        Task<QuestionDto?> UpdateQuestionAsync(string testId, string questionId, SaveQuestionRequest request, CancellationToken cancellationToken = default);
        Task<bool> DeleteQuestionAsync(string testId, string questionId, CancellationToken cancellationToken = default);
        Task<SubmitTestResponse?> SubmitTestAsync(string testId, SubmitTestRequest request, CancellationToken cancellationToken = default);
        Task<ScreenMonitorEventDto?> RecordScreenMonitorEventAsync(string testId, ScreenMonitorEventRequest request, CancellationToken cancellationToken = default);
        Task<string> ExplainQuestionAsync(string testId, string questionId, string selectedAnswerId, CancellationToken cancellationToken = default);
    }
}
