namespace ExamWeb.Application.IService
{
    public interface IAiAssistantService
    {
        Task<string> GetExplanationAsync(
            string questionContent,
            string studentAnswer,
            string correctAnswer,
            CancellationToken cancellationToken = default);
    }
}
