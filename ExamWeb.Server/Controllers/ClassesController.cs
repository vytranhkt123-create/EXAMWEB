using ExamWeb.Application.DTO.OnlineClass;
using ExamWeb.Application.IService;
using ExamWeb.Domain.DomainExceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExamWeb.Server.Controllers
{
    [ApiController]
    [Route("api/classes")]
    [Authorize(Roles = "Admin,User")]
    public class ClassesController : ControllerBase
    {
        private readonly IOnlineClassService _onlineClassService;

        public ClassesController(IOnlineClassService onlineClassService)
        {
            _onlineClassService = onlineClassService;
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<OnlineClassRoomDto>>> GetClasses(CancellationToken cancellationToken)
        {
            try
            {
                var classes = await _onlineClassService.GetAccessibleRoomsAsync(cancellationToken);
                return Ok(classes);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("{classRoomId}")]
        public async Task<ActionResult<OnlineClassRoomDto>> GetClass(string classRoomId, CancellationToken cancellationToken)
        {
            try
            {
                var classes = await _onlineClassService.GetAccessibleRoomsAsync(cancellationToken);
                var classRoom = classes.FirstOrDefault(x => x.Id == classRoomId);
                return classRoom == null ? NotFound() : Ok(classRoom);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<ActionResult<OnlineClassRoomDto>> CreateClass(
            CreateOnlineClassRoomRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var classRoom = await _onlineClassService.CreateRoomAsync(request, cancellationToken);
                return Created($"/api/classes/{Uri.EscapeDataString(classRoom.Id)}", classRoom);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("{classRoomId}/members")]
        public async Task<ActionResult<AssignClassRoomMembersResultDto>> AssignMembers(
            string classRoomId,
            AssignClassRoomMembersRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var result = await _onlineClassService.AssignRoomMembersAsync(classRoomId, request, cancellationToken);
                return Ok(result);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{classRoomId}")]
        public async Task<IActionResult> DeleteClass(string classRoomId, CancellationToken cancellationToken)
        {
            try
            {
                var deleted = await _onlineClassService.DeleteClassAsync(classRoomId, cancellationToken);
                return deleted ? NoContent() : NotFound();
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
