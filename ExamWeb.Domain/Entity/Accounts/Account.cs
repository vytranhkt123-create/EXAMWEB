using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.Accounts
{
    public class Account
    {
        protected Account() { }
        public int Id { get; private set; }
        public string Username { get; private set; } = string.Empty;
        public string DisplayName { get; private set; } = string.Empty;
        public string Role { get; private set; } = string.Empty;
        public string PasswordHash { get; private set; } = string.Empty;
        public string? Grade { get; private set; }
        public string? ClassName { get; private set; }
        public Account(string username, string displayName, string role)
        {
            if (string.IsNullOrWhiteSpace(username)) throw new DomainException("Username không được để trống");
            Username = username;
            ChangeDisplayName(displayName);
            ChangeRole(role);
        }
        public void ChangeDisplayName(string displayName)
        {
            if (string.IsNullOrWhiteSpace(displayName)) throw new DomainException("Tên hiển thị không được để trống");
            DisplayName = displayName.Trim();
        }
        public void ChangeRole(string role)
        {
            if (role != "Admin" && role != "User") throw new DomainException("Vai trò tài khoản không hợp lệ");
            Role = role;
        }
        public void ChangePasswordHash(string newPasswordHash)
        {
            if (string.IsNullOrWhiteSpace(newPasswordHash)) throw new DomainException("Mật khẩu mã hoá không được trống");
            PasswordHash = newPasswordHash;
        }

        public void ChangeStudentInfo(string? grade, string? className)
        {
            Grade = string.IsNullOrWhiteSpace(grade) ? null : grade.Trim();
            ClassName = string.IsNullOrWhiteSpace(className) ? null : className.Trim();
        }
    }
}
