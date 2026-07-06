using ExamWeb.Application.DTO.Chat;
using ExamWeb.Application.IService;
using ExamWeb.Domain.DomainExceptions;
using ExamWeb.Domain.Entity.Chats;
using ExamWeb.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ExamWeb.Infrastructure.Services
{
    public class ChatService : IChatService
    {
        private const int MaxPageSize = 80;
        private readonly AppDbContext _dbContext;
        private readonly ICurrentUserService _currentUser;

        public ChatService(AppDbContext dbContext, ICurrentUserService currentUser)
        {
            _dbContext = dbContext;
            _currentUser = currentUser;
        }

        public async Task<IReadOnlyList<ChatContactDto>> GetContactsAsync(CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(null, cancellationToken);

            var contacts = await _dbContext.Accounts
                .AsNoTracking()
                .Where(x => x.Id != actor.AccountId)
                .OrderBy(x => x.Role == "Admin" ? 0 : 1)
                .ThenBy(x => x.DisplayName)
                .Select(x => new ChatContactDto
                {
                    AccountId = x.Id,
                    Username = x.Username,
                    DisplayName = x.DisplayName,
                    Role = x.Role,
                    Grade = x.Grade,
                    ClassName = x.ClassName,
                    AvatarText = string.Empty
                })
                .ToListAsync(cancellationToken);

            foreach (var contact in contacts)
            {
                contact.AvatarText = BuildAvatarText(contact.DisplayName, contact.Username);
            }

            return contacts;
        }

        public async Task<IReadOnlyList<ChatRoomDto>> GetRoomsAsync(CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(null, cancellationToken);
            var directRoomIds = await _dbContext.ChatRoomParticipants
                .AsNoTracking()
                .Where(x => x.AccountId == actor.AccountId)
                .Select(x => x.RoomId)
                .ToListAsync(cancellationToken);

            var accessibleRoomIds = directRoomIds.ToHashSet();

            if (actor.Role == "Admin")
            {
                var scopedRoomIds = await _dbContext.ChatRooms
                    .AsNoTracking()
                    .Where(x => x.Type != ChatRoomType.Direct)
                    .Select(x => x.Id)
                    .ToListAsync(cancellationToken);

                accessibleRoomIds.UnionWith(scopedRoomIds);
            }
            else
            {
                var classRoomIds = await _dbContext.ClassRoomMembers
                    .AsNoTracking()
                    .Where(x => x.AccountId == actor.AccountId)
                    .Select(x => x.RoomId)
                    .ToListAsync(cancellationToken);

                if (classRoomIds.Count > 0)
                {
                    var scopedClassChatIds = await _dbContext.ChatRooms
                        .AsNoTracking()
                        .Where(x => x.Type == ChatRoomType.OnlineClass && x.ScopeId != null && classRoomIds.Contains(x.ScopeId))
                        .Select(x => x.Id)
                        .ToListAsync(cancellationToken);

                    accessibleRoomIds.UnionWith(scopedClassChatIds);
                }

                var accessibleTestIds = await _dbContext.TestStudentAccesses
                    .AsNoTracking()
                    .Where(x => x.AccountId == actor.AccountId)
                    .Select(x => x.TestId)
                    .ToListAsync(cancellationToken);

                if (accessibleTestIds.Count > 0)
                {
                    var arenaIds = await _dbContext.Arenas
                        .AsNoTracking()
                        .Where(x => accessibleTestIds.Contains(x.TestId))
                        .Select(x => x.Id)
                        .ToListAsync(cancellationToken);

                    if (arenaIds.Count > 0)
                    {
                        var scopedArenaChatIds = await _dbContext.ChatRooms
                            .AsNoTracking()
                            .Where(x => x.Type == ChatRoomType.Arena && x.ScopeId != null && arenaIds.Contains(x.ScopeId))
                            .Select(x => x.Id)
                            .ToListAsync(cancellationToken);

                        accessibleRoomIds.UnionWith(scopedArenaChatIds);
                    }
                }
            }

            if (accessibleRoomIds.Count == 0)
            {
                return Array.Empty<ChatRoomDto>();
            }

            var rooms = await _dbContext.ChatRooms
                .AsNoTracking()
                .Where(x => accessibleRoomIds.Contains(x.Id))
                .OrderByDescending(x => x.LastMessageAt ?? x.CreatedAt)
                .ToListAsync(cancellationToken);

            return await MapRoomsAsync(rooms, actor.AccountId, cancellationToken);
        }

        public async Task<ChatRoomDto> GetOrCreateDirectRoomAsync(
            CreateDirectChatRequest request,
            CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(null, cancellationToken);
            if (request.TargetAccountId <= 0 || request.TargetAccountId == actor.AccountId)
            {
                throw new DomainException("Target account is invalid");
            }

            var target = await _dbContext.Accounts
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == request.TargetAccountId, cancellationToken)
                ?? throw new DomainException("Target account was not found");

            var directKey = BuildDirectKey(actor.AccountId, request.TargetAccountId);
            var room = await _dbContext.ChatRooms
                .Include(x => x.Participants)
                .FirstOrDefaultAsync(x => x.Type == ChatRoomType.Direct && x.DirectKey == directKey, cancellationToken);

            if (room == null)
            {
                room = new ChatRoom(
                    ChatRoomType.Direct,
                    $"{actor.DisplayName}, {target.DisplayName}",
                    actor.AccountId,
                    directKey: directKey);

                _dbContext.ChatRooms.Add(room);
                _dbContext.ChatRoomParticipants.Add(new ChatRoomParticipant(room.Id, actor.AccountId));
                _dbContext.ChatRoomParticipants.Add(new ChatRoomParticipant(room.Id, target.Id));
                await _dbContext.SaveChangesAsync(cancellationToken);
            }

            var mapped = await MapRoomsAsync(new[] { room }, actor.AccountId, cancellationToken);
            return mapped[0];
        }

        public async Task<ChatRoomDto> GetOrCreateScopedRoomAsync(
            CreateScopedChatRoomRequest request,
            CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(null, cancellationToken);
            var type = ParseScopedRoomType(request.ScopeType);
            var scopeId = string.IsNullOrWhiteSpace(request.ScopeId)
                ? throw new DomainException("Scope id is required")
                : request.ScopeId.Trim();

            var title = await GetScopedRoomTitleAsync(type, scopeId, actor, cancellationToken);
            var canAccess = await CanAccessScopedRoomAsync(type, scopeId, actor, cancellationToken);
            if (!canAccess)
            {
                throw new DomainException("You do not have access to this chat room");
            }

            var room = await _dbContext.ChatRooms
                .FirstOrDefaultAsync(x => x.Type == type && x.ScopeId == scopeId, cancellationToken);

            if (room == null)
            {
                room = new ChatRoom(type, title, actor.AccountId, scopeId: scopeId);
                _dbContext.ChatRooms.Add(room);
                await _dbContext.SaveChangesAsync(cancellationToken);
            }

            await EnsureParticipantAsync(room.Id, actor.AccountId, cancellationToken);

            var mapped = await MapRoomsAsync(new[] { room }, actor.AccountId, cancellationToken);
            return mapped[0];
        }

        public async Task<ChatHistoryPageDto> GetMessagesAsync(
            string roomId,
            ChatHistoryQuery query,
            CancellationToken cancellationToken = default)
        {
            var actor = await ResolveActorAsync(null, cancellationToken);
            if (!await CanAccessRoomAsync(roomId, actor, cancellationToken))
            {
                throw new DomainException("You do not have access to this chat room");
            }

            var pageSize = Math.Clamp(query.PageSize <= 0 ? 40 : query.PageSize, 1, MaxPageSize);
            var messagesQuery = _dbContext.ChatMessages
                .AsNoTracking()
                .Include(x => x.Reactions)
                .Include(x => x.ReadReceipts)
                .Where(x => x.RoomId == roomId);

            if (query.Before.HasValue)
            {
                messagesQuery = messagesQuery.Where(x => x.CreatedAt < query.Before.Value);
            }

            var rows = await messagesQuery
                .OrderByDescending(x => x.CreatedAt)
                .Take(pageSize + 1)
                .ToListAsync(cancellationToken);

            var hasMore = rows.Count > pageSize;
            var messages = rows
                .Take(pageSize)
                .OrderBy(x => x.CreatedAt)
                .Select(x => MapMessage(x, actor.AccountId))
                .ToList();

            return new ChatHistoryPageDto
            {
                RoomId = roomId,
                Messages = messages,
                HasMore = hasMore,
                NextBefore = hasMore ? rows[pageSize - 1].CreatedAt : null
            };
        }

        public async Task<ChatMessageDto> SendMessageAsync(
            SendChatRequest request,
            ChatActorDto? actor = null,
            CancellationToken cancellationToken = default)
        {
            var resolvedActor = await ResolveActorAsync(actor, cancellationToken);
            var roomId = string.IsNullOrWhiteSpace(request.RoomId)
                ? throw new DomainException("Chat room is required")
                : request.RoomId.Trim();

            if (!await CanAccessRoomAsync(roomId, resolvedActor, cancellationToken))
            {
                throw new DomainException("You do not have access to this chat room");
            }

            var room = await _dbContext.ChatRooms
                .FirstAsync(x => x.Id == roomId, cancellationToken);

            await EnsureParticipantAsync(room.Id, resolvedActor.AccountId, cancellationToken);

            var message = new ChatMessage(
                room.Id,
                resolvedActor.AccountId,
                resolvedActor.DisplayName,
                resolvedActor.Role,
                request.Text);

            room.TouchLastMessage();
            _dbContext.ChatMessages.Add(message);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return MapMessage(message, resolvedActor.AccountId);
        }

        public async Task<ChatMessageDto?> EditMessageAsync(
            string messageId,
            UpdateChatMessageRequest request,
            ChatActorDto? actor = null,
            CancellationToken cancellationToken = default)
        {
            var resolvedActor = await ResolveActorAsync(actor, cancellationToken);
            var message = await _dbContext.ChatMessages
                .Include(x => x.Reactions)
                .Include(x => x.ReadReceipts)
                .FirstOrDefaultAsync(x => x.Id == messageId, cancellationToken);

            if (message == null)
            {
                return null;
            }

            await EnsureCanManageMessageAsync(message, resolvedActor, allowAdmin: false, cancellationToken);
            message.Edit(request.Text);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return MapMessage(message, resolvedActor.AccountId);
        }

        public async Task<ChatMessageDto?> SoftDeleteMessageAsync(
            string messageId,
            ChatActorDto? actor = null,
            CancellationToken cancellationToken = default)
        {
            var resolvedActor = await ResolveActorAsync(actor, cancellationToken);
            var message = await _dbContext.ChatMessages
                .Include(x => x.Reactions)
                .Include(x => x.ReadReceipts)
                .FirstOrDefaultAsync(x => x.Id == messageId, cancellationToken);

            if (message == null)
            {
                return null;
            }

            await EnsureCanManageMessageAsync(message, resolvedActor, allowAdmin: true, cancellationToken);
            message.SoftDelete(resolvedActor.AccountId);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return MapMessage(message, resolvedActor.AccountId);
        }

        public async Task<ChatMessageDto?> ToggleReactionAsync(
            string messageId,
            ReactToMessageRequest request,
            ChatActorDto? actor = null,
            CancellationToken cancellationToken = default)
        {
            var resolvedActor = await ResolveActorAsync(actor, cancellationToken);
            var message = await _dbContext.ChatMessages
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == messageId, cancellationToken);

            if (message == null)
            {
                return null;
            }

            if (message.IsDeleted)
            {
                throw new DomainException("Deleted messages cannot be reacted to");
            }

            if (!await CanAccessRoomAsync(message.RoomId, resolvedActor, cancellationToken))
            {
                throw new DomainException("You do not have access to this chat room");
            }

            var cleanEmoji = string.IsNullOrWhiteSpace(request.Emoji) ? string.Empty : request.Emoji.Trim();
            var existing = await _dbContext.ChatReactions
                .FirstOrDefaultAsync(
                    x => x.MessageId == messageId && x.AccountId == resolvedActor.AccountId && x.Emoji == cleanEmoji,
                    cancellationToken);

            if (existing == null)
            {
                _dbContext.ChatReactions.Add(new ChatReaction(messageId, resolvedActor.AccountId, cleanEmoji));
            }
            else
            {
                _dbContext.ChatReactions.Remove(existing);
            }

            await _dbContext.SaveChangesAsync(cancellationToken);

            var updated = await _dbContext.ChatMessages
                .AsNoTracking()
                .Include(x => x.Reactions)
                .Include(x => x.ReadReceipts)
                .FirstAsync(x => x.Id == messageId, cancellationToken);

            return MapMessage(updated, resolvedActor.AccountId);
        }

        public async Task<ChatReadDto> MarkReadAsync(
            string roomId,
            MarkChatReadRequest request,
            ChatActorDto? actor = null,
            CancellationToken cancellationToken = default)
        {
            var resolvedActor = await ResolveActorAsync(actor, cancellationToken);
            if (!await CanAccessRoomAsync(roomId, resolvedActor, cancellationToken))
            {
                throw new DomainException("You do not have access to this chat room");
            }

            var cutoff = DateTime.UtcNow;
            string? lastMessageId = null;
            if (!string.IsNullOrWhiteSpace(request.LastMessageId))
            {
                var lastMessage = await _dbContext.ChatMessages
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == request.LastMessageId && x.RoomId == roomId, cancellationToken)
                    ?? throw new DomainException("Read marker message was not found");

                cutoff = lastMessage.CreatedAt;
                lastMessageId = lastMessage.Id;
            }

            var seenAt = DateTime.UtcNow;
            var messageIds = await _dbContext.ChatMessages
                .AsNoTracking()
                .Where(x =>
                    x.RoomId == roomId &&
                    x.CreatedAt <= cutoff &&
                    !x.IsDeleted &&
                    x.AuthorAccountId != resolvedActor.AccountId)
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);

            if (messageIds.Count > 0)
            {
                var existingReceipts = await _dbContext.ChatReadReceipts
                    .Where(x => x.AccountId == resolvedActor.AccountId && messageIds.Contains(x.MessageId))
                    .ToDictionaryAsync(x => x.MessageId, cancellationToken);

                foreach (var messageId in messageIds)
                {
                    if (existingReceipts.TryGetValue(messageId, out var receipt))
                    {
                        receipt.MarkSeen(seenAt);
                    }
                    else
                    {
                        _dbContext.ChatReadReceipts.Add(new ChatReadReceipt(messageId, resolvedActor.AccountId, seenAt));
                    }
                }
            }

            var participant = await _dbContext.ChatRoomParticipants
                .FirstOrDefaultAsync(
                    x => x.RoomId == roomId && x.AccountId == resolvedActor.AccountId,
                    cancellationToken);

            if (participant == null)
            {
                _dbContext.ChatRoomParticipants.Add(new ChatRoomParticipant(roomId, resolvedActor.AccountId));
            }
            else
            {
                participant.MarkSeen(seenAt);
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
            return new ChatReadDto
            {
                RoomId = roomId,
                AccountId = resolvedActor.AccountId,
                LastMessageId = lastMessageId,
                SeenAt = seenAt
            };
        }

        public async Task<bool> CanAccessRoomAsync(
            string roomId,
            ChatActorDto? actor = null,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(roomId))
            {
                return false;
            }

            var resolvedActor = await ResolveActorAsync(actor, cancellationToken);
            var room = await _dbContext.ChatRooms
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == roomId, cancellationToken);

            if (room == null)
            {
                return false;
            }

            if (room.Type == ChatRoomType.Direct)
            {
                return await _dbContext.ChatRoomParticipants
                    .AsNoTracking()
                    .AnyAsync(
                        x => x.RoomId == room.Id && x.AccountId == resolvedActor.AccountId,
                        cancellationToken);
            }

            return await CanAccessScopedRoomAsync(room.Type, room.ScopeId, resolvedActor, cancellationToken);
        }

        private async Task EnsureCanManageMessageAsync(
            ChatMessage message,
            ChatActorDto actor,
            bool allowAdmin,
            CancellationToken cancellationToken)
        {
            if (!await CanAccessRoomAsync(message.RoomId, actor, cancellationToken))
            {
                throw new DomainException("You do not have access to this chat room");
            }

            if (message.AuthorAccountId == actor.AccountId)
            {
                return;
            }

            if (allowAdmin && actor.Role == "Admin")
            {
                return;
            }

            throw new DomainException("You cannot manage this message");
        }

        private async Task<ChatActorDto> ResolveActorAsync(ChatActorDto? actor, CancellationToken cancellationToken)
        {
            var accountId = actor?.AccountId > 0
                ? actor.AccountId
                : _currentUser.AccountId;

            if (!accountId.HasValue)
            {
                throw new DomainException("You must be signed in to use chat");
            }

            var account = await _dbContext.Accounts
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == accountId.Value, cancellationToken)
                ?? throw new DomainException("Signed-in account was not found");

            return new ChatActorDto
            {
                AccountId = account.Id,
                Username = account.Username,
                DisplayName = string.IsNullOrWhiteSpace(actor?.DisplayName) ? account.DisplayName : actor.DisplayName,
                Role = string.IsNullOrWhiteSpace(actor?.Role) ? account.Role : actor.Role
            };
        }

        private async Task EnsureParticipantAsync(string roomId, int accountId, CancellationToken cancellationToken)
        {
            var exists = await _dbContext.ChatRoomParticipants
                .AnyAsync(x => x.RoomId == roomId && x.AccountId == accountId, cancellationToken);

            if (!exists)
            {
                _dbContext.ChatRoomParticipants.Add(new ChatRoomParticipant(roomId, accountId));
                await _dbContext.SaveChangesAsync(cancellationToken);
            }
        }

        private async Task<IReadOnlyList<ChatRoomDto>> MapRoomsAsync(
            IReadOnlyCollection<ChatRoom> rooms,
            int currentAccountId,
            CancellationToken cancellationToken)
        {
            var roomIds = rooms.Select(x => x.Id).ToList();
            if (roomIds.Count == 0)
            {
                return Array.Empty<ChatRoomDto>();
            }

            var participantsByRoom = await _dbContext.ChatRoomParticipants
                .AsNoTracking()
                .Where(x => roomIds.Contains(x.RoomId))
                .Join(
                    _dbContext.Accounts.AsNoTracking(),
                    participant => participant.AccountId,
                    account => account.Id,
                    (participant, account) => new
                    {
                        participant.RoomId,
                        participant.AccountId,
                        participant.JoinedAt,
                        participant.LastSeenAt,
                        account.DisplayName,
                        account.Username,
                        account.Role
                    })
                .OrderBy(x => x.DisplayName)
                .ToListAsync(cancellationToken);

            var participantLookup = participantsByRoom
                .GroupBy(x => x.RoomId)
                .ToDictionary(
                    group => group.Key,
                    group => (IReadOnlyList<ChatParticipantDto>)group
                        .Select(x => new ChatParticipantDto
                        {
                            AccountId = x.AccountId,
                            DisplayName = x.DisplayName,
                            Username = x.Username,
                            Role = x.Role,
                            JoinedAt = x.JoinedAt,
                            LastSeenAt = x.LastSeenAt
                        })
                        .ToList());

            var lastMessages = await _dbContext.ChatMessages
                .AsNoTracking()
                .Where(x => roomIds.Contains(x.RoomId))
                .GroupBy(x => x.RoomId)
                .Select(x => x.OrderByDescending(message => message.CreatedAt).First())
                .ToListAsync(cancellationToken);

            var lastMessageLookup = lastMessages.ToDictionary(x => x.RoomId, x => x);

            var unreadCounts = await _dbContext.ChatMessages
                .AsNoTracking()
                .Where(x =>
                    roomIds.Contains(x.RoomId) &&
                    x.AuthorAccountId != currentAccountId &&
                    !x.IsDeleted &&
                    !_dbContext.ChatReadReceipts.Any(r => r.MessageId == x.Id && r.AccountId == currentAccountId))
                .GroupBy(x => x.RoomId)
                .Select(x => new { RoomId = x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.RoomId, x => x.Count, cancellationToken);

            return rooms.Select(room =>
            {
                participantLookup.TryGetValue(room.Id, out var participants);
                participants ??= Array.Empty<ChatParticipantDto>();
                unreadCounts.TryGetValue(room.Id, out var unreadCount);
                lastMessageLookup.TryGetValue(room.Id, out var lastMessage);

                var title = room.Title;
                if (room.Type == ChatRoomType.Direct)
                {
                    title = participants.FirstOrDefault(x => x.AccountId != currentAccountId)?.DisplayName
                        ?? room.Title;
                }

                return new ChatRoomDto
                {
                    Id = room.Id,
                    Type = room.Type.ToString(),
                    Title = title,
                    ScopeId = room.ScopeId,
                    CreatedAt = room.CreatedAt,
                    LastMessageAt = room.LastMessageAt,
                    Participants = participants,
                    UnreadCount = unreadCount,
                    LastMessage = lastMessage == null ? null : MapMessage(lastMessage, currentAccountId)
                };
            }).ToList();
        }

        private static ChatMessageDto MapMessage(ChatMessage message, int currentAccountId)
        {
            return new ChatMessageDto
            {
                Id = message.Id,
                RoomId = message.RoomId,
                AuthorAccountId = message.AuthorAccountId,
                AuthorDisplayName = message.AuthorDisplayName,
                AuthorRole = message.AuthorRole,
                Text = message.IsDeleted ? string.Empty : message.Text,
                CreatedAt = message.CreatedAt,
                EditedAt = message.EditedAt,
                IsDeleted = message.IsDeleted,
                DeletedAt = message.DeletedAt,
                DeletedByAccountId = message.DeletedByAccountId,
                Reactions = message.Reactions
                    .GroupBy(x => x.Emoji)
                    .Select(group => new ChatReactionSummaryDto
                    {
                        Emoji = group.Key,
                        Count = group.Count(),
                        IsMine = group.Any(x => x.AccountId == currentAccountId),
                        AccountIds = group.Select(x => x.AccountId).OrderBy(x => x).ToList()
                    })
                    .OrderByDescending(x => x.Count)
                    .ThenBy(x => x.Emoji)
                    .ToList(),
                ReadReceipts = message.ReadReceipts
                    .Select(x => new ChatReadReceiptDto
                    {
                        AccountId = x.AccountId,
                        SeenAt = x.SeenAt
                    })
                    .OrderBy(x => x.SeenAt)
                    .ToList()
            };
        }

        private async Task<string> GetScopedRoomTitleAsync(
            ChatRoomType type,
            string scopeId,
            ChatActorDto actor,
            CancellationToken cancellationToken)
        {
            if (type == ChatRoomType.OnlineClass)
            {
                var room = await _dbContext.OnlineClassRooms
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == scopeId, cancellationToken)
                    ?? throw new DomainException("Online class room was not found");

                return room.Name;
            }

            if (type == ChatRoomType.Arena)
            {
                var arena = await _dbContext.Arenas
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.Id == scopeId, cancellationToken)
                    ?? throw new DomainException("Arena was not found");

                return arena.Name;
            }

            throw new DomainException("Scoped room type is invalid");
        }

        private async Task<bool> CanAccessScopedRoomAsync(
            ChatRoomType type,
            string? scopeId,
            ChatActorDto actor,
            CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(scopeId))
            {
                return false;
            }

            if (actor.Role == "Admin")
            {
                return true;
            }

            if (type == ChatRoomType.OnlineClass)
            {
                return await _dbContext.ClassRoomMembers
                    .AsNoTracking()
                    .AnyAsync(
                        x => x.RoomId == scopeId && x.AccountId == actor.AccountId,
                        cancellationToken);
            }

            if (type == ChatRoomType.Arena)
            {
                return await _dbContext.Arenas
                    .AsNoTracking()
                    .Where(x => x.Id == scopeId)
                    .Join(
                        _dbContext.TestStudentAccesses.AsNoTracking().Where(x => x.AccountId == actor.AccountId),
                        arena => arena.TestId,
                        access => access.TestId,
                        (arena, _) => arena.Id)
                    .AnyAsync(cancellationToken);
            }

            return false;
        }

        private static ChatRoomType ParseScopedRoomType(string scopeType)
        {
            var normalized = (scopeType ?? string.Empty).Trim();
            if (normalized.Equals("OnlineClass", StringComparison.OrdinalIgnoreCase) ||
                normalized.Equals("ClassRoom", StringComparison.OrdinalIgnoreCase) ||
                normalized.Equals("Course", StringComparison.OrdinalIgnoreCase))
            {
                return ChatRoomType.OnlineClass;
            }

            if (normalized.Equals("Arena", StringComparison.OrdinalIgnoreCase))
            {
                return ChatRoomType.Arena;
            }

            throw new DomainException("Scope type is invalid");
        }

        private static string BuildDirectKey(int firstAccountId, int secondAccountId)
        {
            var ordered = new[] { firstAccountId, secondAccountId }.OrderBy(x => x).ToArray();
            return $"{ordered[0]}:{ordered[1]}";
        }

        private static string BuildAvatarText(string? displayName, string? username)
        {
            var source = string.IsNullOrWhiteSpace(displayName) ? username : displayName;
            var parts = (source ?? "?")
                .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);

            if (parts.Length == 0)
            {
                return "?";
            }

            return string.Concat(parts.Take(2).Select(part => char.ToUpperInvariant(part[0])));
        }
    }
}
