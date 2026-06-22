using ExamWeb.Infrastructure.Data;
using ExamWeb.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ExamWeb.Server.Controllers
{
    [ApiController]
    [Route("api/arenas")]
    [Authorize(Roles = "Admin")]
    public class ArenaController : ControllerBase
    {
        private readonly AppDbContext _dbContext;

        public ArenaController(AppDbContext dbContext)
        {
            _dbContext = dbContext;
        }

        [HttpPost("create/{testId}")]
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
