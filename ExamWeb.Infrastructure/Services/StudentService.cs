using ExamWeb.Application.DTO.Students;
using ExamWeb.Application.IService;
using ExamWeb.Domain.DomainExceptions;
using ExamWeb.Domain.Entity.Accounts;
using ExamWeb.Infrastructure.Data;
using ExamWeb.Infrastructure.Helpers;
using ExamWeb.Infrastructure.Security;
using Microsoft.EntityFrameworkCore;

namespace ExamWeb.Infrastructure.Services
{
    public class StudentService : IStudentService
    {
        private const string DefaultStudentPassword = "123456";
        private const int MaxUsernameLength = 80;

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
            var fullName = request.FullName?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(fullName))
            {
                throw new DomainException("Họ tên không được bỏ trống");
            }

            var username = await GenerateUniqueUsernameAsync(fullName, cancellationToken);
            var account = new Account(username, fullName, "User");
            account.ChangeStudentInfo(request.Grade, request.ClassName);
            account.ChangePasswordHash(PasswordHashing.Hash(DefaultStudentPassword));
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

            await _dbContext.SaveChangesAsync(cancellationToken);
            return MapStudent(account);
        }

        public async Task<bool> ChangePasswordAsync(int studentId, ChangePasswordRequest request, CancellationToken cancellationToken = default)
        {
            var newPassword = request.NewPassword?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(newPassword))
            {
                throw new DomainException("Mật khẩu mới không được bỏ trống");
            }

            var account = await _dbContext.Accounts
                .FirstOrDefaultAsync(x => x.Id == studentId && x.Role == "User", cancellationToken);

            if (account == null)
            {
                return false;
            }

            account.ChangePasswordHash(PasswordHashing.Hash(newPassword));
            await _dbContext.SaveChangesAsync(cancellationToken);
            return true;
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

        private async Task<string> GenerateUniqueUsernameAsync(string fullName, CancellationToken cancellationToken)
        {
            var baseLocalPart = VietnameseUsernameHelper.CreateLocalPartFromFullName(fullName);
            var suffixNumber = 0;

            while (true)
            {
                var localPart = TrimLocalPartForUsername(baseLocalPart, suffixNumber);
                var username = VietnameseUsernameHelper.BuildUsername(
                    localPart,
                    suffixNumber == 0 ? null : suffixNumber);

                var exists = await _dbContext.Accounts
                    .AnyAsync(x => x.Username == username, cancellationToken);

                if (!exists)
                {
                    return username;
                }

                suffixNumber++;
            }
        }

        private static string TrimLocalPartForUsername(string localPart, int suffixNumber)
        {
            var suffixLength = suffixNumber == 0 ? 0 : suffixNumber.ToString().Length;
            var maxLocalLength = MaxUsernameLength - VietnameseUsernameHelper.DomainSuffix.Length - suffixLength;
            if (maxLocalLength <= 0)
            {
                return localPart;
            }

            return localPart.Length <= maxLocalLength
                ? localPart
                : localPart[..maxLocalLength];
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
