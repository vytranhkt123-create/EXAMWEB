using ExamWeb.Application.DTO.OnlineClass;
using ExamWeb.Application.IService;
using ExamWeb.Domain.DomainExceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExamWeb.Server.Controllers
{
    [ApiController]
    [Route("api/classes/{classRoomId}/videos")]
    [Authorize(Roles = "Admin,User")]
    public class ClassVideosController : ControllerBase
    {
        private readonly IOnlineClassService _onlineClassService;

        public ClassVideosController(IOnlineClassService onlineClassService)
        {
            _onlineClassService = onlineClassService;
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<ClassVideoDto>>> GetVideos(
            string classRoomId,
            CancellationToken cancellationToken)
        {
            try
            {
                var videos = await _onlineClassService.GetClassVideosAsync(classRoomId, cancellationToken);
                return Ok(videos);
            }
            catch (DomainException ex)
            {
                return StatusCode(StatusCodes.Status403Forbidden, new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<ActionResult<ClassVideoDto>> CreateVideo(
            string classRoomId,
            CreateClassVideoRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var video = await _onlineClassService.CreateClassVideoAsync(classRoomId, request, cancellationToken);
                return CreatedAtAction(nameof(GetVideos), new { classRoomId }, video);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{videoId}")]
        public async Task<ActionResult<ClassVideoDto>> UpdateVideo(
            string classRoomId,
            string videoId,
            CreateClassVideoRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var video = await _onlineClassService.UpdateClassVideoAsync(classRoomId, videoId, request, cancellationToken);
                return video == null ? NotFound() : Ok(video);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{videoId}")]
        public async Task<IActionResult> DeleteVideo(
            string classRoomId,
            string videoId,
            CancellationToken cancellationToken)
        {
            try
            {
                var deleted = await _onlineClassService.DeleteClassVideoAsync(classRoomId, videoId, cancellationToken);
                return deleted ? NoContent() : NotFound();
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
