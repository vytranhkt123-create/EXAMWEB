namespace ExamWeb.Application.DTO.Auth
{
    public class LoginResponse
    {
        public string AccessToken { get; set; } = string.Empty;
        public int AccountId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? Grade { get; set; }
        public string? ClassName { get; set; }
        public DateTime ExpiredAt { get; set; }
    }
}
