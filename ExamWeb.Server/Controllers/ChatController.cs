using ExamWeb.Application.DTO.Chat;
using ExamWeb.Application.IService;
using ExamWeb.Domain.DomainExceptions;
using ExamWeb.Server.Hubs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;

namespace ExamWeb.Server.Controllers
{
    [ApiController]
    [Route("api/chat")]
    [Authorize(Roles = "Admin,User")]
    public class ChatController : ControllerBase
    {
        private readonly IChatService _chatService;
        private readonly IHubContext<ChatHub> _hubContext;

        public ChatController(IChatService chatService, IHubContext<ChatHub> hubContext)
        {
            _chatService = chatService;
            _hubContext = hubContext;
        }

        [HttpGet("contacts")]
        public async Task<ActionResult<IReadOnlyList<ChatContactDto>>> GetContacts(CancellationToken cancellationToken)
        {
            return Ok(await _chatService.GetContactsAsync(cancellationToken));
        }

        [HttpGet("rooms")]
        public async Task<ActionResult<IReadOnlyList<ChatRoomDto>>> GetRooms(CancellationToken cancellationToken)
        {
            return Ok(await _chatService.GetRoomsAsync(cancellationToken));
        }

        [HttpPost("direct")]
        public async Task<ActionResult<ChatRoomDto>> GetOrCreateDirectRoom(
            CreateDirectChatRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                return Ok(await _chatService.GetOrCreateDirectRoomAsync(request, cancellationToken));
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPost("scoped-room")]
        public async Task<ActionResult<ChatRoomDto>> GetOrCreateScopedRoom(
            CreateScopedChatRoomRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                return Ok(await _chatService.GetOrCreateScopedRoomAsync(request, cancellationToken));
            }
            catch (DomainException ex)
            {
                return ToDomainError(ex);
            }
        }

        [HttpGet("rooms/{roomId}/messages")]
        public async Task<ActionResult<ChatHistoryPageDto>> GetMessages(
            string roomId,
            [FromQuery] DateTime? before,
            [FromQuery] int pageSize = 40,
            CancellationToken cancellationToken = default)
        {
            try
            {
                return Ok(await _chatService.GetMessagesAsync(
                    roomId,
                    new ChatHistoryQuery { Before = before, PageSize = pageSize },
                    cancellationToken));
            }
            catch (DomainException ex)
            {
                return ToDomainError(ex);
            }
        }

        [HttpPost("messages")]
        public async Task<ActionResult<ChatMessageDto>> SendMessage(
            SendChatRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var message = await _chatService.SendMessageAsync(request, cancellationToken: cancellationToken);
                await _hubContext.Clients
                    .Group(ChatHub.RoomGroupName(message.RoomId))
                    .SendAsync("ReceiveMessage", message, cancellationToken);
                return Ok(message);
            }
            catch (DomainException ex)
            {
                return ToDomainError(ex);
            }
        }

        [HttpPut("messages/{messageId}")]
        public async Task<ActionResult<ChatMessageDto>> EditMessage(
            string messageId,
            UpdateChatMessageRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var message = await _chatService.EditMessageAsync(messageId, request, cancellationToken: cancellationToken);
                if (message == null)
                {
                    return NotFound();
                }

                await _hubContext.Clients
                    .Group(ChatHub.RoomGroupName(message.RoomId))
                    .SendAsync("MessageEdited", message, cancellationToken);
                return Ok(message);
            }
            catch (DomainException ex)
            {
                return ToDomainError(ex);
            }
        }

        [HttpDelete("messages/{messageId}")]
        public async Task<ActionResult<ChatMessageDto>> DeleteMessage(string messageId, CancellationToken cancellationToken)
        {
            try
            {
                var message = await _chatService.SoftDeleteMessageAsync(messageId, cancellationToken: cancellationToken);
                if (message == null)
                {
                    return NotFound();
                }

                await _hubContext.Clients
                    .Group(ChatHub.RoomGroupName(message.RoomId))
                    .SendAsync("MessageDeleted", message, cancellationToken);
                return Ok(message);
            }
            catch (DomainException ex)
            {
                return ToDomainError(ex);
            }
        }

        [HttpPost("messages/{messageId}/reactions")]
        public async Task<ActionResult<ChatMessageDto>> ToggleReaction(
            string messageId,
            ReactToMessageRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var message = await _chatService.ToggleReactionAsync(messageId, request, cancellationToken: cancellationToken);
                if (message == null)
                {
                    return NotFound();
                }

                await _hubContext.Clients
                    .Group(ChatHub.RoomGroupName(message.RoomId))
                    .SendAsync("MessageReacted", message, cancellationToken);
                return Ok(message);
            }
            catch (DomainException ex)
            {
                return ToDomainError(ex);
            }
        }

        [HttpPost("rooms/{roomId}/read")]
        public async Task<ActionResult<ChatReadDto>> MarkRead(
            string roomId,
            MarkChatReadRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var read = await _chatService.MarkReadAsync(roomId, request, cancellationToken: cancellationToken);
                await _hubContext.Clients
                    .Group(ChatHub.RoomGroupName(roomId))
                    .SendAsync("MessageSeen", read, cancellationToken);
                return Ok(read);
            }
            catch (DomainException ex)
            {
                return ToDomainError(ex);
            }
        }

        private ObjectResult ToDomainError(DomainException ex)
        {
            var message = ex.Message;
            var statusCode = message.Contains("access", StringComparison.OrdinalIgnoreCase) ||
                message.Contains("cannot", StringComparison.OrdinalIgnoreCase)
                    ? StatusCodes.Status403Forbidden
                    : StatusCodes.Status400BadRequest;

            return StatusCode(statusCode, new { message });
        }
    }
}
