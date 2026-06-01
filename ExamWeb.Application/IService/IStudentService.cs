using ExamWeb.Application.DTO.Students;

namespace ExamWeb.Application.IService
{
    public interface IStudentService
    {
        Task<IReadOnlyList<StudentDto>> GetStudentsAsync(CancellationToken cancellationToken = default);
        Task<StudentDto> CreateStudentAsync(CreateStudentRequest request, CancellationToken cancellationToken = default);
        Task<StudentDto?> UpdateStudentAsync(int studentId, UpdateStudentRequest request, CancellationToken cancellationToken = default);
        Task<bool> ChangePasswordAsync(int studentId, ChangePasswordRequest request, CancellationToken cancellationToken = default);
        Task<bool> DeleteStudentAsync(int studentId, CancellationToken cancellationToken = default);
    }
}
