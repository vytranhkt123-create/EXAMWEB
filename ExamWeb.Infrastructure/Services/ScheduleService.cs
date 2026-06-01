using ExamWeb.Application.DTO.Schedules;
using ExamWeb.Application.IService;
using ExamWeb.Domain.DomainExceptions;
using ExamWeb.Domain.Entity.Accounts;
using ExamWeb.Domain.Entity.Schedules;
using ExamWeb.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ExamWeb.Infrastructure.Services
{
    public class ScheduleService : IScheduleService
    {
        private readonly AppDbContext _dbContext;
        private readonly ICurrentUserService _currentUser;

        public ScheduleService(AppDbContext dbContext, ICurrentUserService currentUser)
        {
            _dbContext = dbContext;
            _currentUser = currentUser;
        }

        public async Task<IReadOnlyList<ClassScheduleDto>> GetSchedulesAsync(CancellationToken cancellationToken = default)
        {
            var schedules = await _dbContext.ClassSchedules
                .Include(x => x.Attendances)
                .AsNoTracking()
                .OrderBy(x => x.StartTime)
                .ToListAsync(cancellationToken);

            var creatorNames = await LoadCreatorNamesAsync(schedules.Select(x => x.CreatedBy), cancellationToken);
            var currentAccountId = _currentUser.AccountId;

            return schedules
                .Select(schedule =>
                {
                    var myAttendance = currentAccountId.HasValue
                        ? schedule.Attendances.FirstOrDefault(x => x.AccountId == currentAccountId.Value)
                        : null;

                    return MapSchedule(schedule, creatorNames, myAttendance);
                })
                .ToList();
        }

        public async Task<ClassScheduleDetailDto?> GetScheduleAsync(string scheduleId, CancellationToken cancellationToken = default)
        {
            var schedule = await _dbContext.ClassSchedules
                .Include(x => x.Attendances)
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == scheduleId, cancellationToken);

            if (schedule == null)
            {
                return null;
            }

            var visibleAttendances = GetVisibleAttendances(schedule).ToList();
            var creatorNames = await LoadCreatorNamesAsync(new[] { schedule.CreatedBy }, cancellationToken);
            var accounts = await LoadAccountsAsync(visibleAttendances.Select(x => x.AccountId), cancellationToken);

            return MapScheduleDetail(schedule, creatorNames, accounts, visibleAttendances, GetMyAttendance(schedule));
        }

        public async Task<ClassScheduleDetailDto> CreateScheduleAsync(CreateClassScheduleRequest request, CancellationToken cancellationToken = default)
        {
            var schedule = new ClassSchedule(
                request.Title,
                request.Description,
                request.StartTime,
                request.EndTime,
                _currentUser.AccountId);

            _dbContext.ClassSchedules.Add(schedule);
            await _dbContext.SaveChangesAsync(cancellationToken);

            var creatorNames = await LoadCreatorNamesAsync(new[] { schedule.CreatedBy }, cancellationToken);
            return MapScheduleDetail(
                schedule,
                creatorNames,
                new Dictionary<int, Account>(),
                Array.Empty<ScheduleAttendance>(),
                null);
        }

        public async Task<ClassScheduleDetailDto?> UpdateScheduleAsync(
            string scheduleId,
            UpdateClassScheduleRequest request,
            CancellationToken cancellationToken = default)
        {
            var schedule = await _dbContext.ClassSchedules
                .Include(x => x.Attendances)
                .FirstOrDefaultAsync(x => x.Id == scheduleId, cancellationToken);

            if (schedule == null)
            {
                return null;
            }

            schedule.Update(request.Title, request.Description, request.StartTime, request.EndTime);
            await _dbContext.SaveChangesAsync(cancellationToken);

            var visibleAttendances = GetVisibleAttendances(schedule).ToList();
            var creatorNames = await LoadCreatorNamesAsync(new[] { schedule.CreatedBy }, cancellationToken);
            var accounts = await LoadAccountsAsync(visibleAttendances.Select(x => x.AccountId), cancellationToken);

            return MapScheduleDetail(schedule, creatorNames, accounts, visibleAttendances, GetMyAttendance(schedule));
        }

        public async Task<bool> DeleteScheduleAsync(string scheduleId, CancellationToken cancellationToken = default)
        {
            var schedule = await _dbContext.ClassSchedules
                .FirstOrDefaultAsync(x => x.Id == scheduleId, cancellationToken);

            if (schedule == null)
            {
                return false;
            }

            _dbContext.ClassSchedules.Remove(schedule);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }

        public async Task<IReadOnlyList<ScheduleAttendanceDto>> GetAttendanceRequestsAsync(
            string? scheduleId = null,
            string? status = null,
            CancellationToken cancellationToken = default)
        {
            var query = _dbContext.ScheduleAttendances
                .Include(x => x.Schedule)
                .AsNoTracking()
                .AsQueryable();

            if (!string.IsNullOrWhiteSpace(scheduleId))
            {
                query = query.Where(x => x.ScheduleId == scheduleId);
            }

            if (string.IsNullOrWhiteSpace(status))
            {
                query = query.Where(x =>
                    x.Status == ScheduleAttendanceStatuses.Absent ||
                    x.Status == ScheduleAttendanceStatuses.Late);
            }
            else
            {
                var normalizedStatus = ScheduleAttendanceStatuses.Normalize(status);
                query = query.Where(x => x.Status == normalizedStatus);
            }

            var attendances = await query
                .OrderByDescending(x => x.UpdatedAt)
                .ToListAsync(cancellationToken);

            var accounts = await LoadAccountsAsync(attendances.Select(x => x.AccountId), cancellationToken);

            return attendances
                .Select(attendance => MapAttendance(attendance, GetAccount(accounts, attendance.AccountId), attendance.Schedule))
                .ToList();
        }

        public async Task<ScheduleAttendanceDto?> UpsertMyAttendanceAsync(
            string scheduleId,
            UpsertScheduleAttendanceRequest request,
            CancellationToken cancellationToken = default)
        {
            if (!_currentUser.IsStudent || !_currentUser.AccountId.HasValue)
            {
                throw new DomainException("Chỉ học sinh mới được báo vắng hoặc đi muộn");
            }

            var normalizedStatus = NormalizeStudentAttendanceStatus(request.Status);
            var accountId = _currentUser.AccountId.Value;

            var schedule = await _dbContext.ClassSchedules
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == scheduleId, cancellationToken);

            if (schedule == null)
            {
                return null;
            }

            var account = await _dbContext.Accounts
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == accountId, cancellationToken);

            if (account == null)
            {
                throw new DomainException("Tài khoản không hợp lệ");
            }

            var attendance = await _dbContext.ScheduleAttendances
                .FirstOrDefaultAsync(
                    x => x.ScheduleId == scheduleId && x.AccountId == accountId,
                    cancellationToken);

            if (attendance == null)
            {
                attendance = new ScheduleAttendance(scheduleId, accountId, normalizedStatus, request.Reason);
                _dbContext.ScheduleAttendances.Add(attendance);
            }
            else
            {
                attendance.Update(normalizedStatus, request.Reason);
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
            return MapAttendance(attendance, account, schedule);
        }

        private IEnumerable<ScheduleAttendance> GetVisibleAttendances(ClassSchedule schedule)
        {
            if (_currentUser.IsAdmin)
            {
                return schedule.Attendances;
            }

            if (_currentUser.IsStudent && _currentUser.AccountId.HasValue)
            {
                return schedule.Attendances.Where(x => x.AccountId == _currentUser.AccountId.Value);
            }

            return Array.Empty<ScheduleAttendance>();
        }

        private ScheduleAttendance? GetMyAttendance(ClassSchedule schedule)
        {
            return _currentUser.AccountId.HasValue
                ? schedule.Attendances.FirstOrDefault(x => x.AccountId == _currentUser.AccountId.Value)
                : null;
        }

        private async Task<Dictionary<int, string>> LoadCreatorNamesAsync(
            IEnumerable<int?> creatorIds,
            CancellationToken cancellationToken)
        {
            var ids = creatorIds
                .Where(x => x.HasValue)
                .Select(x => x!.Value)
                .Distinct()
                .ToList();

            if (ids.Count == 0)
            {
                return new Dictionary<int, string>();
            }

            return await _dbContext.Accounts
                .AsNoTracking()
                .Where(x => ids.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.DisplayName, cancellationToken);
        }

        private async Task<Dictionary<int, Account>> LoadAccountsAsync(
            IEnumerable<int> accountIds,
            CancellationToken cancellationToken)
        {
            var ids = accountIds
                .Where(x => x > 0)
                .Distinct()
                .ToList();

            if (ids.Count == 0)
            {
                return new Dictionary<int, Account>();
            }

            return await _dbContext.Accounts
                .AsNoTracking()
                .Where(x => ids.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
        }

        private static string NormalizeStudentAttendanceStatus(string status)
        {
            var normalizedStatus = ScheduleAttendanceStatuses.Normalize(status);
            if (normalizedStatus == ScheduleAttendanceStatuses.Present)
            {
                throw new DomainException("Học sinh chỉ có thể báo vắng hoặc đi muộn");
            }

            return normalizedStatus;
        }

        private static ClassScheduleDto MapSchedule(
            ClassSchedule schedule,
            IReadOnlyDictionary<int, string> creatorNames,
            ScheduleAttendance? myAttendance = null)
        {
            var dto = new ClassScheduleDto();
            FillScheduleFields(dto, schedule, creatorNames, myAttendance, null);
            return dto;
        }

        private static ClassScheduleDetailDto MapScheduleDetail(
            ClassSchedule schedule,
            IReadOnlyDictionary<int, string> creatorNames,
            IReadOnlyDictionary<int, Account> accounts,
            IEnumerable<ScheduleAttendance> visibleAttendances,
            ScheduleAttendance? myAttendance)
        {
            var myAttendanceAccount = myAttendance == null
                ? null
                : GetAccount(accounts, myAttendance.AccountId);
            var dto = new ClassScheduleDetailDto
            {
                Attendances = visibleAttendances
                    .OrderByDescending(x => x.UpdatedAt)
                    .Select(x => MapAttendance(x, GetAccount(accounts, x.AccountId), schedule))
                    .ToList()
            };

            FillScheduleFields(dto, schedule, creatorNames, myAttendance, myAttendanceAccount);
            return dto;
        }

        private static void FillScheduleFields(
            ClassScheduleDto dto,
            ClassSchedule schedule,
            IReadOnlyDictionary<int, string> creatorNames,
            ScheduleAttendance? myAttendance,
            Account? myAttendanceAccount)
        {
            dto.Id = schedule.Id;
            dto.Title = schedule.Title;
            dto.Description = schedule.Description;
            dto.StartTime = schedule.StartTime;
            dto.EndTime = schedule.EndTime;
            dto.CreatedBy = schedule.CreatedBy;
            dto.CreatedByName = schedule.CreatedBy.HasValue && creatorNames.TryGetValue(schedule.CreatedBy.Value, out var creatorName)
                ? creatorName
                : string.Empty;
            dto.CreatedAt = schedule.CreatedAt;
            dto.AttendanceSummary = MapSummary(schedule);
            dto.MyAttendance = myAttendance == null
                ? null
                : MapAttendance(myAttendance, myAttendanceAccount, schedule);
        }

        private static AttendanceSummaryDto MapSummary(ClassSchedule schedule)
        {
            return new AttendanceSummaryDto
            {
                PresentCount = schedule.Attendances.Count(x => x.Status == ScheduleAttendanceStatuses.Present),
                AbsentCount = schedule.Attendances.Count(x => x.Status == ScheduleAttendanceStatuses.Absent),
                LateCount = schedule.Attendances.Count(x => x.Status == ScheduleAttendanceStatuses.Late)
            };
        }

        private static ScheduleAttendanceDto MapAttendance(
            ScheduleAttendance attendance,
            Account? account,
            ClassSchedule schedule)
        {
            return new ScheduleAttendanceDto
            {
                Id = attendance.Id,
                ScheduleId = attendance.ScheduleId,
                ScheduleTitle = schedule.Title,
                StartTime = schedule.StartTime,
                EndTime = schedule.EndTime,
                AccountId = attendance.AccountId,
                StudentName = account?.DisplayName ?? string.Empty,
                Grade = account?.Grade,
                ClassName = account?.ClassName,
                Status = attendance.Status,
                Reason = attendance.Reason,
                UpdatedAt = attendance.UpdatedAt
            };
        }

        private static Account? GetAccount(IReadOnlyDictionary<int, Account> accounts, int accountId)
        {
            return accounts.TryGetValue(accountId, out var account) ? account : null;
        }
    }
}
