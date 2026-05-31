using ExamWeb.Application.DTO.Tests;
using ExamWeb.Application.IService;
using ExamWeb.Domain.DomainExceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExamWeb.Server.Controllers
{
    [ApiController]
    [Route("api/tests")]
    public class TestsController : ControllerBase
    {
        private readonly ITestService _testService;

        public TestsController(ITestService testService)
        {
            _testService = testService;
        }

        [Authorize(Roles = "Admin,User")]
        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<TestListDto>>> GetTests(CancellationToken cancellationToken)
        {
            var tests = await _testService.GetTestsAsync(cancellationToken);
            return Ok(tests);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("{testId}")]
        public async Task<ActionResult<TestDetailDto>> GetTest(string testId, CancellationToken cancellationToken)
        {
            var test = await _testService.GetTestAsync(testId, cancellationToken);
            return test == null ? NotFound() : Ok(test);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("{testId}/attempts")]
        public async Task<ActionResult<IReadOnlyList<ExamAttemptDto>>> GetAttempts(string testId, CancellationToken cancellationToken)
        {
            var attempts = await _testService.GetAttemptsAsync(testId, cancellationToken);
            return Ok(attempts);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("{testId}/monitoring")]
        public async Task<ActionResult<IReadOnlyList<ScreenMonitorSessionDto>>> GetScreenMonitoring(string testId, CancellationToken cancellationToken)
        {
            var sessions = await _testService.GetScreenMonitorSessionsAsync(testId, cancellationToken);
            return Ok(sessions);
        }

        [Authorize(Roles = "User")]
        [HttpPost("{testId}/monitoring")]
        public async Task<ActionResult<ScreenMonitorEventDto>> RecordScreenMonitoring(string testId, ScreenMonitorEventRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var monitorEvent = await _testService.RecordScreenMonitorEventAsync(testId, request, cancellationToken);
                return monitorEvent == null ? NotFound() : Ok(monitorEvent);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "User")]
        [HttpGet("{testId}/take")]
        public async Task<ActionResult<TestTakeDto>> GetTestForTaking(string testId, CancellationToken cancellationToken)
        {
            try
            {
                var test = await _testService.GetTestForTakingAsync(testId, cancellationToken);
                return test == null ? NotFound() : Ok(test);
            }
            catch (DomainException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<ActionResult<TestDetailDto>> CreateTest(CreateTestRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var test = await _testService.CreateTestAsync(request, cancellationToken);
                return CreatedAtAction(nameof(GetTest), new { testId = test.Id }, test);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{testId}")]
        public async Task<ActionResult<TestDetailDto>> UpdateTest(string testId, UpdateTestRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var test = await _testService.UpdateTestAsync(testId, request, cancellationToken);
                return test == null ? NotFound() : Ok(test);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{testId}")]
        public async Task<IActionResult> DeleteTest(string testId, CancellationToken cancellationToken)
        {
            var deleted = await _testService.DeleteTestAsync(testId, cancellationToken);
            return deleted ? NoContent() : NotFound();
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("{testId}/questions")]
        public async Task<ActionResult<QuestionDto>> AddQuestion(string testId, SaveQuestionRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var question = await _testService.AddQuestionAsync(testId, request, cancellationToken);
                return question == null ? NotFound() : Ok(question);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{testId}/questions/{questionId}")]
        public async Task<ActionResult<QuestionDto>> UpdateQuestion(string testId, string questionId, SaveQuestionRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var question = await _testService.UpdateQuestionAsync(testId, questionId, request, cancellationToken);
                return question == null ? NotFound() : Ok(question);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{testId}/questions/{questionId}")]
        public async Task<IActionResult> DeleteQuestion(string testId, string questionId, CancellationToken cancellationToken)
        {
            var deleted = await _testService.DeleteQuestionAsync(testId, questionId, cancellationToken);
            return deleted ? NoContent() : NotFound();
        }

        [Authorize(Roles = "User")]
        [HttpPost("{testId}/submit")]
        public async Task<ActionResult<SubmitTestResponse>> SubmitTest(string testId, SubmitTestRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var result = await _testService.SubmitTestAsync(testId, request, cancellationToken);
                return result == null ? NotFound() : Ok(result);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
