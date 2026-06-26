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
