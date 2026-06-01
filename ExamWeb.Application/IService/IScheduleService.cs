using ExamWeb.Application.DTO.Schedules;

namespace ExamWeb.Application.IService
{
    public interface IScheduleService
    {
        Task<IReadOnlyList<ClassScheduleDto>> GetSchedulesAsync(CancellationToken cancellationToken = default);
        Task<ClassScheduleDetailDto?> GetScheduleAsync(string scheduleId, CancellationToken cancellationToken = default);
        Task<ClassScheduleDetailDto> CreateScheduleAsync(CreateClassScheduleRequest request, CancellationToken cancellationToken = default);
        Task<ClassScheduleDetailDto?> UpdateScheduleAsync(string scheduleId, UpdateClassScheduleRequest request, CancellationToken cancellationToken = default);
        Task<bool> DeleteScheduleAsync(string scheduleId, CancellationToken cancellationToken = default);
        Task<IReadOnlyList<ScheduleAttendanceDto>> GetAttendanceRequestsAsync(string? scheduleId = null, string? status = null, CancellationToken cancellationToken = default);
        Task<ScheduleAttendanceDto?> UpsertMyAttendanceAsync(string scheduleId, UpsertScheduleAttendanceRequest request, CancellationToken cancellationToken = default);
    }
}
