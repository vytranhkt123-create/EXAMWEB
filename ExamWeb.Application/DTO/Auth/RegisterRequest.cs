namespace ExamWeb.Application.DTO.Auth
{
    public class RegisterRequest
    {
        public string FullName { get; set; } = string.Empty;
        public string? Grade { get; set; }
        public string? ClassName { get; set; }
    }
}
