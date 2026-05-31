using ExamWeb.Application.DTO.OnlineClass;
using ExamWeb.Application.IService;
using ExamWeb.Domain.DomainExceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExamWeb.Server.Controllers
{
    [ApiController]
    [Route("api/online-class")]
    [Authorize(Roles = "Admin,User")]
    public class OnlineClassController : ControllerBase
    {
        private readonly IOnlineClassService _onlineClassService;

        public OnlineClassController(IOnlineClassService onlineClassService)
        {
            _onlineClassService = onlineClassService;
        }

        [HttpGet]
        public async Task<ActionResult<OnlineClassDto>> GetOnlineClass(CancellationToken cancellationToken)
        {
            var onlineClass = await _onlineClassService.GetOnlineClassAsync(cancellationToken);
            return Ok(onlineClass);
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("settings")]
        public async Task<ActionResult<OnlineClassDto>> UpdateSettings(UpdateOnlineClassRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var onlineClass = await _onlineClassService.UpdateOnlineClassAsync(request, cancellationToken);
                return Ok(onlineClass);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("live")]
        public async Task<ActionResult<OnlineClassDto>> SetLive(SetOnlineClassLiveRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var onlineClass = await _onlineClassService.SetLiveAsync(request.IsLive, cancellationToken);
                return Ok(onlineClass);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("whiteboard/snapshots")]
        public async Task<ActionResult<IReadOnlyList<WhiteboardSnapshotDto>>> GetWhiteboardSnapshots(CancellationToken cancellationToken)
        {
            var snapshots = await _onlineClassService.GetWhiteboardSnapshotsAsync(cancellationToken);
            return Ok(snapshots);
        }

        [HttpPost("whiteboard")]
        public async Task<ActionResult<WhiteboardSnapshotDto>> SaveWhiteboard(SaveWhiteboardRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var snapshot = await _onlineClassService.SaveWhiteboardAsync(request, cancellationToken);
                return Ok(snapshot);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("whiteboard/snapshots/{snapshotId}/use")]
        public async Task<ActionResult<OnlineClassDto>> UseWhiteboardSnapshot(string snapshotId, CancellationToken cancellationToken)
        {
            try
            {
                var onlineClass = await _onlineClassService.UseWhiteboardSnapshotAsync(snapshotId, cancellationToken);
                return onlineClass == null ? NotFound() : Ok(onlineClass);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("whiteboard/snapshots/{snapshotId}")]
        public async Task<IActionResult> DeleteWhiteboardSnapshot(string snapshotId, CancellationToken cancellationToken)
        {
            try
            {
                var deleted = await _onlineClassService.DeleteWhiteboardSnapshotAsync(snapshotId, cancellationToken);
                return deleted ? NoContent() : NotFound();
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("chat")]
        public async Task<ActionResult<IReadOnlyList<ChatMessageDto>>> GetChatMessages(CancellationToken cancellationToken)
        {
            var messages = await _onlineClassService.GetChatMessagesAsync(cancellationToken);
            return Ok(messages);
        }

        [HttpPost("chat")]
        public async Task<ActionResult<ChatMessageDto>> SendChatMessage(SendChatMessageRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var message = await _onlineClassService.SendChatMessageAsync(request, cancellationToken);
                return Ok(message);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("chat")]
        public async Task<IActionResult> ClearChatMessages(CancellationToken cancellationToken)
        {
            try
            {
                await _onlineClassService.ClearChatMessagesAsync(cancellationToken);
                return NoContent();
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("rooms")]
        public async Task<ActionResult<OnlineClassRoomDto>> CreateRoom(
            CreateOnlineClassRoomRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var room = await _onlineClassService.CreateRoomAsync(request, cancellationToken);
                return CreatedAtAction(nameof(GetRooms), new { id = room.Id }, room);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPost("rooms/{roomId}/members")]
        public async Task<ActionResult<AssignClassRoomMembersResultDto>> AssignRoomMembers(
            string roomId,
            AssignClassRoomMembersRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var result = await _onlineClassService.AssignRoomMembersAsync(roomId, request, cancellationToken);
                return Ok(result);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("rooms")]
        public async Task<ActionResult<IReadOnlyList<OnlineClassRoomDto>>> GetRooms(CancellationToken cancellationToken)
        {
            try
            {
                var rooms = await _onlineClassService.GetAccessibleRoomsAsync(cancellationToken);
                return Ok(rooms);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
