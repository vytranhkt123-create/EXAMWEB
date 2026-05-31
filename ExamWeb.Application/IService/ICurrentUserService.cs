namespace ExamWeb.Application.IService
{
    public interface ICurrentUserService
    {
        int? AccountId { get; }
        string? Username { get; }
        string? Role { get; }
        bool IsAuthenticated { get; }
        bool IsAdmin { get; }
        bool IsStudent { get; }
    }
}
