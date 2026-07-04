using ExamWeb.Application.DTO.Arenas;
using ExamWeb.Application.IService;
using ExamWeb.Infrastructure.Data;
using ExamWeb.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using ArenaQuestionDto = ExamWeb.Server.Services.ArenaQuestionDto;
using ArenaAnswerDto = ExamWeb.Server.Services.ArenaAnswerDto;

namespace ExamWeb.Server.Controllers
{
    [ApiController]
    [Route("api/arenas")]
    [Authorize]
    public class ArenaController : ControllerBase
    {
        private readonly AppDbContext _dbContext;
        private readonly IArenaService _arenaService;

        public ArenaController(AppDbContext dbContext, IArenaService arenaService)
        {
            _dbContext = dbContext;
            _arenaService = arenaService;
        }

        [HttpGet]
        public async Task<IActionResult> GetArenas(CancellationToken cancellationToken)
        {
            var arenas = await _arenaService.GetArenasAsync(cancellationToken);
            return Ok(arenas);
        }

        [HttpGet("{arenaId}")]
        public async Task<IActionResult> GetArena(string arenaId, CancellationToken cancellationToken)
        {
            var arena = await _arenaService.GetArenaAsync(arenaId, cancellationToken);
            if (arena == null)
            {
                return NotFound(new { message = "Không tìm thấy đấu trường này." });
            }
            return Ok(arena);
        }

        [HttpPost]
        public async Task<IActionResult> CreateArena(CreateArenaRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var response = await _arenaService.CreateArenaAsync(request, cancellationToken);
                return Ok(response);
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("{arenaId}")]
        public async Task<IActionResult> UpdateArena(string arenaId, UpdateArenaRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var arena = await _arenaService.UpdateArenaAsync(arenaId, request, cancellationToken);
                if (arena == null)
                {
                    return NotFound(new { message = "Không tìm thấy đấu trường này." });
                }
                return Ok(arena);
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("{arenaId}")]
        public async Task<IActionResult> DeleteArena(string arenaId, CancellationToken cancellationToken)
        {
            try
            {
                var result = await _arenaService.DeleteArenaAsync(arenaId, cancellationToken);
                if (!result)
                {
                    return NotFound(new { message = "Không tìm thấy đấu trường này." });
                }
                return Ok(new { message = "Đã xóa đấu trường thành công." });
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("{arenaId}/activate")]
        public async Task<IActionResult> ActivateArena(string arenaId, CancellationToken cancellationToken)
        {
            try
            {
                var result = await _arenaService.ActivateArenaAsync(arenaId, cancellationToken);
                if (!result)
                {
                    return NotFound(new { message = "Không tìm thấy đấu trường này." });
                }
                return Ok(new { message = "Đã kích hoạt đấu trường thành công." });
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("{arenaId}/deactivate")]
        public async Task<IActionResult> DeactivateArena(string arenaId, CancellationToken cancellationToken)
        {
            try
            {
                var result = await _arenaService.DeactivateArenaAsync(arenaId, cancellationToken);
                if (!result)
                {
                    return NotFound(new { message = "Không tìm thấy đấu trường này." });
                }
                return Ok(new { message = "Đã hủy kích hoạt đấu trường thành công." });
            }
            catch (System.Exception ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("create-room/{testId}")]
        [Authorize(Roles = "Admin")]
        public async Task<IActionResult> CreateRoom(string testId, CancellationToken cancellationToken)
        {
            var test = await _dbContext.Tests
                .AsNoTracking()
                .Include(t => t.Questions)
                    .ThenInclude(q => q.Answers)
                .FirstOrDefaultAsync(t => t.Id == testId, cancellationToken);

            if (test == null)
            {
                return NotFound(new { message = "Không tìm thấy đề thi này." });
            }

            var questionsDto = test.Questions
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

            if (questionsDto.Count == 0)
            {
                return BadRequest(new { message = "Đề thi này chưa có câu hỏi nào để thi đấu." });
            }

            var roomId = ArenaSocketManager.CreateRoom(test.Id, test.TestName, questionsDto);

            return Ok(new
            {
                roomId,
                testId = test.Id,
                testName = test.TestName,
                questionCount = questionsDto.Count
            });
        }
    }
}
//a