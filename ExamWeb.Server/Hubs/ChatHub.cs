using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using ExamWeb.Application.DTO.Chat;
using ExamWeb.Application.IService;
using ExamWeb.Domain.DomainExceptions;
using ExamWeb.Server.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace ExamWeb.Server.Hubs
{
    [Authorize(Roles = "Admin,User")]
    public class ChatHub : Hub
    {
        private readonly IChatService _chatService;
        private readonly ChatPresenceTracker _presenceTracker;

        public ChatHub(IChatService chatService, ChatPresenceTracker presenceTracker)
        {
            _chatService = chatService;
            _presenceTracker = presenceTracker;
        }

        public static string RoomGroupName(string roomId) => $"chat-room:{roomId}";

        public override async Task OnConnectedAsync()
        {
            var actor = GetActor();
            var (presence, becameOnline) = _presenceTracker.UserConnected(Context.ConnectionId, actor);

            await Clients.Caller.SendAsync("PresenceSnapshot", _presenceTracker.GetOnlineUsers(), Context.ConnectionAborted);
            if (becameOnline)
            {
                await Clients.All.SendAsync("UserPresenceChanged", presence, Context.ConnectionAborted);
            }

            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var presence = _presenceTracker.UserDisconnected(Context.ConnectionId);
            if (presence != null)
            {
                await Clients.All.SendAsync("UserPresenceChanged", presence, CancellationToken.None);
            }

            await base.OnDisconnectedAsync(exception);
        }

        public async Task JoinRoom(string roomId)
        {
            var actor = GetActor();
            if (!await _chatService.CanAccessRoomAsync(roomId, actor, Context.ConnectionAborted))
            {
                throw new HubException("You do not have access to this chat room");
            }

            await Groups.AddToGroupAsync(Context.ConnectionId, RoomGroupName(roomId), Context.ConnectionAborted);
            await Clients.Caller.SendAsync("RoomJoined", new { roomId }, Context.ConnectionAborted);
        }

        public async Task LeaveRoom(string roomId)
        {
            if (!string.IsNullOrWhiteSpace(roomId))
            {
                await Groups.RemoveFromGroupAsync(Context.ConnectionId, RoomGroupName(roomId), Context.ConnectionAborted);
            }
        }

        public async Task SendMessage(SendChatRequest request)
        {
            try
            {
                var actor = GetActor();
                var message = await _chatService.SendMessageAsync(request, actor, Context.ConnectionAborted);
                await Clients.Group(RoomGroupName(message.RoomId)).SendAsync("ReceiveMessage", message, Context.ConnectionAborted);
            }
            catch (DomainException ex)
            {
                throw new HubException(ex.Message);
            }
        }

        public async Task EditMessage(string messageId, UpdateChatMessageRequest request)
        {
            try
            {
                var actor = GetActor();
                var message = await _chatService.EditMessageAsync(messageId, request, actor, Context.ConnectionAborted);
                if (message == null)
                {
                    throw new HubException("Message was not found");
                }

                await Clients.Group(RoomGroupName(message.RoomId)).SendAsync("MessageEdited", message, Context.ConnectionAborted);
            }
            catch (DomainException ex)
            {
                throw new HubException(ex.Message);
            }
        }

        public async Task DeleteMessage(string messageId)
        {
            try
            {
                var actor = GetActor();
                var message = await _chatService.SoftDeleteMessageAsync(messageId, actor, Context.ConnectionAborted);
                if (message == null)
                {
                    throw new HubException("Message was not found");
                }

                await Clients.Group(RoomGroupName(message.RoomId)).SendAsync("MessageDeleted", message, Context.ConnectionAborted);
            }
            catch (DomainException ex)
            {
                throw new HubException(ex.Message);
            }
        }

        public async Task ReactToMessage(string messageId, ReactToMessageRequest request)
        {
            try
            {
                var actor = GetActor();
                var message = await _chatService.ToggleReactionAsync(messageId, request, actor, Context.ConnectionAborted);
                if (message == null)
                {
                    throw new HubException("Message was not found");
                }

                await Clients.Group(RoomGroupName(message.RoomId)).SendAsync("MessageReacted", message, Context.ConnectionAborted);
            }
            catch (DomainException ex)
            {
                throw new HubException(ex.Message);
            }
        }

        public async Task MarkRead(string roomId, MarkChatReadRequest request)
        {
            try
            {
                var actor = GetActor();
                var read = await _chatService.MarkReadAsync(roomId, request, actor, Context.ConnectionAborted);
                await Clients.Group(RoomGroupName(roomId)).SendAsync("MessageSeen", read, Context.ConnectionAborted);
            }
            catch (DomainException ex)
            {
                throw new HubException(ex.Message);
            }
        }

        public async Task Typing(string roomId, bool isTyping)
        {
            var actor = GetActor();
            if (!await _chatService.CanAccessRoomAsync(roomId, actor, Context.ConnectionAborted))
            {
                throw new HubException("You do not have access to this chat room");
            }

            var typing = new ChatTypingDto
            {
                RoomId = roomId,
                AccountId = actor.AccountId,
                DisplayName = actor.DisplayName,
                IsTyping = isTyping
            };

            await Clients.OthersInGroup(RoomGroupName(roomId)).SendAsync("UserTyping", typing, Context.ConnectionAborted);
        }

        private ChatActorDto GetActor()
        {
            var user = Context.User;
            var idValue = user?.FindFirstValue(ClaimTypes.NameIdentifier)
                ?? user?.FindFirstValue(JwtRegisteredClaimNames.Sub);

            if (!int.TryParse(idValue, out var accountId))
            {
                throw new HubException("Signed-in account was not found");
            }

            return new ChatActorDto
            {
                AccountId = accountId,
                Username = user?.FindFirstValue("username") ?? string.Empty,
                DisplayName = user?.FindFirstValue(ClaimTypes.Name) ?? user?.Identity?.Name ?? "User",
                Role = user?.FindFirstValue(ClaimTypes.Role) ?? user?.FindFirstValue("role") ?? "User"
            };
        }
    }
}
