using ExamWeb.Application.DTO.Arenas;
using ExamWeb.Application.IService;
using ExamWeb.Domain.DomainExceptions;
using ExamWeb.Domain.Entity.Arenas;
using ExamWeb.Domain.Entity.Questions;
using ExamWeb.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ExamWeb.Infrastructure.Services
{
    public class ArenaService : IArenaService
    {
        private readonly AppDbContext _dbContext;
        private readonly ICurrentUserService _currentUser;

        public ArenaService(AppDbContext dbContext, ICurrentUserService currentUser)
        {
            _dbContext = dbContext;
            _currentUser = currentUser;
        }

        public async Task<IReadOnlyList<ArenaListDto>> GetArenasAsync(CancellationToken cancellationToken = default)
        {
            var query = _dbContext.Arenas.AsNoTracking();

            // If not admin, only show arenas created by current user
            if (!IsCurrentUserAdmin())
            {
                if (_currentUser.AccountId is not int accountId)
                {
                    return Array.Empty<ArenaListDto>();
                }

                query = query.Where(a => a.CreatedByAccountId == accountId);
            }

            var arenas = await query
                .Include(a => a.Test)
                .OrderByDescending(a => a.CreatedAt)
                .ToListAsync(cancellationToken);

            return arenas.Select(MapToListDto).ToList();
        }

        public async Task<ArenaDetailDto?> GetArenaAsync(string arenaId, CancellationToken cancellationToken = default)
        {
            var arena = await _dbContext.Arenas
                .AsNoTracking()
                .Include(a => a.Test)
                    .ThenInclude(t => t!.Questions)
                        .ThenInclude(q => q.Answers)
                .FirstOrDefaultAsync(a => a.Id == arenaId, cancellationToken);

            if (arena == null)
                return null;

            // Check access permission
            if (!CanManageArena(arena))
                return null;

            return MapToDetailDto(arena);
        }

        public async Task<CreateArenaResponse> CreateArenaAsync(CreateArenaRequest request, CancellationToken cancellationToken = default)
        {
            // Validate test exists and has questions
            var test = await _dbContext.Tests
                .AsNoTracking()
                .Include(t => t.Questions)
                .FirstOrDefaultAsync(t => t.Id == request.TestId, cancellationToken);

            if (test == null)
                throw new DomainException("Không tìm thấy đề thi này");

            if (test.Questions.Count == 0)
                throw new DomainException("Đề thi này chưa có câu hỏi nào");

            var createdByAccountId = _currentUser.AccountId ?? throw new DomainException("Bạn cần đăng nhập để tạo đấu trường");

            var arena = new Arena(
                request.Name,
                request.TestId,
                createdByAccountId,
                request.Description,
                request.ScheduledStartTime,
                request.DurationMinutes
            );

            _dbContext.Arenas.Add(arena);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return new CreateArenaResponse
            {
                ArenaId = arena.Id,
                Name = arena.Name,
                TestId = arena.TestId,
                TestName = test.TestName,
                QuestionCount = test.Questions.Count
            };
        }

        public async Task<ArenaDetailDto?> UpdateArenaAsync(string arenaId, UpdateArenaRequest request, CancellationToken cancellationToken = default)
        {
            var arena = await _dbContext.Arenas
                .FirstOrDefaultAsync(a => a.Id == arenaId, cancellationToken);

            if (arena == null)
                return null;

            // Check permission
            if (!CanManageArena(arena))
                throw new DomainException("Bạn không có quyền cập nhật đấu trường này");

            arena.UpdateInfo(request.Name, request.Description, request.ScheduledStartTime, request.DurationMinutes);

            await _dbContext.SaveChangesAsync(cancellationToken);

            return await GetArenaAsync(arenaId, cancellationToken);
        }

        public async Task<bool> DeleteArenaAsync(string arenaId, CancellationToken cancellationToken = default)
        {
            var arena = await _dbContext.Arenas
                .FirstOrDefaultAsync(a => a.Id == arenaId, cancellationToken);

            if (arena == null)
                return false;

            // Check permission
            if (!CanManageArena(arena))
                throw new DomainException("Bạn không có quyền xóa đấu trường này");

            _dbContext.Arenas.Remove(arena);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return true;
        }

        public async Task<bool> ActivateArenaAsync(string arenaId, CancellationToken cancellationToken = default)
        {
            var arena = await _dbContext.Arenas
                .FirstOrDefaultAsync(a => a.Id == arenaId, cancellationToken);

            if (arena == null)
                return false;

            // Check permission
            if (!CanManageArena(arena))
                throw new DomainException("Bạn không có quyền kích hoạt đấu trường này");

            arena.Activate();
            await _dbContext.SaveChangesAsync(cancellationToken);

            return true;
        }

        public async Task<bool> DeactivateArenaAsync(string arenaId, CancellationToken cancellationToken = default)
        {
            var arena = await _dbContext.Arenas
                .FirstOrDefaultAsync(a => a.Id == arenaId, cancellationToken);

            if (arena == null)
                return false;

            // Check permission
            if (!CanManageArena(arena))
                throw new DomainException("Bạn không có quyền hủy kích hoạt đấu trường này");

            arena.Deactivate();
            await _dbContext.SaveChangesAsync(cancellationToken);

            return true;
        }

        private bool CanManageArena(Arena arena)
        {
            return IsCurrentUserAdmin() ||
                (_currentUser.AccountId is int accountId && arena.CreatedByAccountId == accountId);
        }

        private bool IsCurrentUserAdmin()
        {
            return _currentUser.IsAdmin ||
                string.Equals(_currentUser.Role, "Admin", StringComparison.OrdinalIgnoreCase);
        }

        private static ArenaListDto MapToListDto(Arena arena)
        {
            return new ArenaListDto
            {
                Id = arena.Id,
                Name = arena.Name,
                Description = arena.Description,
                TestId = arena.TestId,
                TestName = arena.Test?.TestName ?? string.Empty,
                ScheduledStartTime = arena.ScheduledStartTime,
                DurationMinutes = arena.DurationMinutes,
                IsActive = arena.IsActive,
                CreatedAt = arena.CreatedAt,
                EndedAt = arena.EndedAt,
                CreatedBy = arena.CreatedByAccountId
            };
        }

        private static ArenaDetailDto MapToDetailDto(Arena arena)
        {
            var dto = new ArenaDetailDto
            {
                Id = arena.Id,
                Name = arena.Name,
                Description = arena.Description,
                TestId = arena.TestId,
                TestName = arena.Test?.TestName ?? string.Empty,
                ScheduledStartTime = arena.ScheduledStartTime,
                DurationMinutes = arena.DurationMinutes,
                IsActive = arena.IsActive,
                CreatedAt = arena.CreatedAt,
                EndedAt = arena.EndedAt,
                CreatedBy = arena.CreatedByAccountId
            };

            if (arena.Test?.Questions != null)
            {
                dto.Questions = arena.Test.Questions
                    .OrderBy(q => q.OrderIndex)
                    .Select(q => new ArenaQuestionDto
                    {
                        Id = q.Id,
                        Content = q.Content,
                        Score = q.Score,
                        OrderIndex = q.OrderIndex,
                        Answers = q.Answers
                            .OrderBy(a => a.OrderIndex)
                            .Select(a => new ArenaAnswerDto
                            {
                                Id = a.Id,
                                Content = a.Content,
                                IsCorrect = a.IsCorrect,
                                OrderIndex = a.OrderIndex
                            }).ToList()
                    }).ToList();
            }

            return dto;
        }
    }
}
