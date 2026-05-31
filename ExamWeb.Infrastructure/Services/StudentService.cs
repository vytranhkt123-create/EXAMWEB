using ExamWeb.Application.DTO.Students;
using ExamWeb.Application.IService;
using ExamWeb.Domain.DomainExceptions;
using ExamWeb.Domain.Entity.Accounts;
using ExamWeb.Infrastructure.Data;
using ExamWeb.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace ExamWeb.Infrastructure.Services
{
    public class StudentService : IStudentService
    {
        private readonly AppDbContext _dbContext;

        public StudentService(AppDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        public async Task<IReadOnlyList<StudentDto>> GetStudentsAsync(CancellationToken cancellationToken = default)
        {
            var students = await _dbContext.Accounts
                .AsNoTracking()
                .Where(x => x.Role == "User")
                .OrderBy(x => x.Grade)
                .ThenBy(x => x.ClassName)
                .ThenBy(x => x.DisplayName)
                .ToListAsync(cancellationToken);

            return students.Select(MapStudent).ToList();
        }

        public async Task<StudentDto> CreateStudentAsync(CreateStudentRequest request, CancellationToken cancellationToken = default)
        {
            var username = request.Username.Trim();
            if (string.IsNullOrWhiteSpace(username))
            {
                throw new DomainException("Tên đăng nhập không được bỏ trống");
            }

            if (string.IsNullOrWhiteSpace(request.Password))
            {
                throw new DomainException("Mật khẩu không được bỏ trống");
            }

            if (await _dbContext.Accounts.AnyAsync(x => x.Username == username, cancellationToken))
            {
                throw new DomainException("Tên đăng nhập đã tồn tại");
            }

            var account = new Account(username, request.DisplayName.Trim(), "User");
            account.ChangeStudentInfo(request.Grade, request.ClassName);
            account.ChangePasswordHash(PasswordHashing.Hash(request.Password));
            _dbContext.Accounts.Add(account);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return MapStudent(account);
        }

        public async Task<StudentDto?> UpdateStudentAsync(int studentId, UpdateStudentRequest request, CancellationToken cancellationToken = default)
        {
            var account = await _dbContext.Accounts
                .FirstOrDefaultAsync(x => x.Id == studentId && x.Role == "User", cancellationToken);

            if (account == null)
            {
                return null;
            }

            account.ChangeDisplayName(request.DisplayName.Trim());
            account.ChangeStudentInfo(request.Grade, request.ClassName);

            if (!string.IsNullOrWhiteSpace(request.Password))
            {
                account.ChangePasswordHash(PasswordHashing.Hash(request.Password));
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
            return MapStudent(account);
        }

        public async Task<bool> DeleteStudentAsync(int studentId, CancellationToken cancellationToken = default)
        {
            var account = await _dbContext.Accounts
                .FirstOrDefaultAsync(x => x.Id == studentId && x.Role == "User", cancellationToken);

            if (account == null)
            {
                return false;
            }

            var accessRows = await _dbContext.TestStudentAccesses
                .Where(x => x.AccountId == studentId)
                .ToListAsync(cancellationToken);
            _dbContext.TestStudentAccesses.RemoveRange(accessRows);
            _dbContext.Accounts.Remove(account);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }

        private static StudentDto MapStudent(Account account)
        {
            return new StudentDto
            {
                Id = account.Id,
                Username = account.Username,
                DisplayName = account.DisplayName,
                Grade = account.Grade,
                ClassName = account.ClassName
            };
        }
    }
}
