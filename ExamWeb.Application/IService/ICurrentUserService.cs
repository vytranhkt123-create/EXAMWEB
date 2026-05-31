namespace ExamWeb.Application.IService
{
    public interface ICurrentUserService
    {
        int? AccountId { get; }
        string? Username { get; }
        string? DisplayName { get; }
        string? Role { get; }
        bool IsAuthenticated { get; }
        bool IsAdmin { get; }
        bool IsStudent { get; }
    }
}
