namespace ExamWeb.Application.DTO.Students
{
    public class StudentDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string? Grade { get; set; }
        public string? ClassName { get; set; }
    }

    public class CreateStudentRequest
    {
        public string FullName { get; set; } = string.Empty;
        public string? Grade { get; set; }
        public string? ClassName { get; set; }
    }

    public class UpdateStudentRequest
    {
        public string DisplayName { get; set; } = string.Empty;
        public string? Grade { get; set; }
        public string? ClassName { get; set; }
    }

    public class ChangePasswordRequest
    {
        public string NewPassword { get; set; } = string.Empty;
    }
}
