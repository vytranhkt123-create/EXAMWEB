using ExamWeb.Application.DTO.OnlineClass;
using ExamWeb.Application.IService;
using ExamWeb.Domain.DomainExceptions;
using ExamWeb.Domain.Entity.OnlineClasses;
using ExamWeb.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ExamWeb.Infrastructure.Services
{
    public class OnlineClassService : IOnlineClassService
    {
        private const int MaxPdfBytes = 12 * 1024 * 1024;
        private const int MaxWhiteboardDataUrlLength = 3_000_000;
        private readonly AppDbContext _dbContext;
        private readonly ICurrentUserService _currentUser;
        private readonly IOnlineClassRealtimeNotifier _notifier;

        public OnlineClassService(
            AppDbContext dbContext,
            ICurrentUserService currentUser,
            IOnlineClassRealtimeNotifier notifier)
        {
            _dbContext = dbContext;
            _currentUser = currentUser;
            _notifier = notifier;
        }

        public async Task<IReadOnlyList<MaterialDto>> GetMaterialsAsync(CancellationToken cancellationToken = default)
        {
            return await _dbContext.ClassMaterials
                .AsNoTracking()
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => new MaterialDto
                {
                    Id = x.Id,
                    Title = x.Title,
                    Description = x.Description,
                    FileName = x.FileName,
                    ContentType = x.ContentType,
                    FileSize = x.FileSize,
                    FileUrl = $"/api/materials/{x.Id}/file",
                    DataUrl = string.Empty,
                    CreatedByAccountId = x.CreatedByAccountId,
                    CreatedByName = x.CreatedByName,
                    CreatedAt = x.CreatedAt
                })
                .ToListAsync(cancellationToken);
        }

        public async Task<MaterialFileDto?> GetMaterialFileAsync(string materialId, CancellationToken cancellationToken = default)
        {
            var material = await _dbContext.ClassMaterials
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == materialId, cancellationToken);

            if (material == null)
            {
                return null;
            }

            return new MaterialFileDto
            {
                FileName = material.FileName,
                ContentType = material.ContentType,
                Content = material.Content
            };
        }

        public async Task<MaterialDto> CreateMaterialAsync(CreateMaterialRequest request, CancellationToken cancellationToken = default)
        {
            RequireAdmin();
            var (contentType, content) = ParsePdfDataUrl(request.DataUrl);
            if (content.Length > MaxPdfBytes)
            {
                throw new DomainException("Tệp PDF vượt quá giới hạn 12MB");
            }

            var material = new ClassMaterial(
                request.Title,
                request.Description,
                request.FileName,
                contentType,
                content,
                _currentUser.AccountId,
                GetCurrentDisplayName());

            _dbContext.ClassMaterials.Add(material);
            await _dbContext.SaveChangesAsync(cancellationToken);
            var dto = MapMaterial(material);
            await _notifier.BroadcastAsync("materials-updated", dto, cancellationToken);
            return dto;
        }

        public async Task<bool> DeleteMaterialAsync(string materialId, CancellationToken cancellationToken = default)
        {
            RequireAdmin();
            var material = await _dbContext.ClassMaterials
                .FirstOrDefaultAsync(x => x.Id == materialId, cancellationToken);

            if (material == null)
            {
                return false;
            }

            _dbContext.ClassMaterials.Remove(material);
            await _dbContext.SaveChangesAsync(cancellationToken);
            await _notifier.BroadcastAsync("materials-updated", new { materialId }, cancellationToken);
            return true;
        }

        public async Task<IReadOnlyList<ClassVideoDto>> GetClassVideosAsync(string classRoomId, CancellationToken cancellationToken = default)
        {
            await EnsureCanAccessRoomAsync(classRoomId, cancellationToken);

            return await _dbContext.ClassVideoMaterials
                .AsNoTracking()
                .Where(x => x.ClassRoomId == classRoomId)
                .OrderByDescending(x => x.CreatedAt)
                .Select(x => new ClassVideoDto
                {
                    Id = x.Id,
                    ClassRoomId = x.ClassRoomId,
                    Title = x.Title,
                    Description = x.Description,
                    YoutubeUrl = x.YoutubeUrl,
                    CreatedAt = x.CreatedAt
                })
                .ToListAsync(cancellationToken);
        }

        public async Task<ClassVideoDto> CreateClassVideoAsync(
            string classRoomId,
            CreateClassVideoRequest request,
            CancellationToken cancellationToken = default)
        {
            RequireAdmin();
            await EnsureRoomExistsAsync(classRoomId, cancellationToken);

            var video = new ClassVideoMaterial(
                classRoomId,
                request.Title,
                request.Description,
                request.YoutubeUrl);

            _dbContext.ClassVideoMaterials.Add(video);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return MapClassVideo(video);
        }

        public async Task<ClassVideoDto?> UpdateClassVideoAsync(
            string classRoomId,
            string videoId,
            CreateClassVideoRequest request,
            CancellationToken cancellationToken = default)
        {
            RequireAdmin();
            await EnsureRoomExistsAsync(classRoomId, cancellationToken);

            var video = await _dbContext.ClassVideoMaterials
                .FirstOrDefaultAsync(x => x.Id == videoId && x.ClassRoomId == classRoomId, cancellationToken);

            if (video == null)
            {
                return null;
            }

            video.ChangeDetails(request.Title, request.Description, request.YoutubeUrl);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return MapClassVideo(video);
        }

        public async Task<bool> DeleteClassVideoAsync(
            string classRoomId,
            string videoId,
            CancellationToken cancellationToken = default)
        {
            RequireAdmin();
            var video = await _dbContext.ClassVideoMaterials
                .FirstOrDefaultAsync(x => x.Id == videoId && x.ClassRoomId == classRoomId, cancellationToken);

            if (video == null)
            {
                return false;
            }

            _dbContext.ClassVideoMaterials.Remove(video);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }

        public async Task<OnlineClassDto> GetOnlineClassAsync(CancellationToken cancellationToken = default)
        {
            var state = await GetOrCreateStateAsync(cancellationToken);
            return MapOnlineClass(state);
        }

        public async Task<OnlineClassDto> UpdateOnlineClassAsync(UpdateOnlineClassRequest request, CancellationToken cancellationToken = default)
        {
            RequireAdmin();
            var state = await GetOrCreateStateAsync(cancellationToken);
            state.ChangeInfo(request.Title, request.Agenda, GetCurrentDisplayName());
            await _dbContext.SaveChangesAsync(cancellationToken);
            var dto = MapOnlineClass(state);
            await _notifier.BroadcastAsync("online-class-updated", dto, cancellationToken);
            return dto;
        }

        public async Task<OnlineClassDto> SetLiveAsync(bool isLive, CancellationToken cancellationToken = default)
        {
            RequireAdmin();
            var state = await GetOrCreateStateAsync(cancellationToken);
            state.ChangeLiveStatus(isLive, GetCurrentDisplayName());
            await _dbContext.SaveChangesAsync(cancellationToken);
            var dto = MapOnlineClass(state);
            await _notifier.BroadcastAsync("online-class-updated", dto, cancellationToken);
            return dto;
        }

        public async Task<IReadOnlyList<WhiteboardSnapshotDto>> GetWhiteboardSnapshotsAsync(CancellationToken cancellationToken = default)
        {
            var snapshots = await _dbContext.WhiteboardSnapshots
                .AsNoTracking()
                .OrderByDescending(x => x.CreatedAt)
                .Take(40)
                .ToListAsync(cancellationToken);

            return snapshots.Select(MapWhiteboardSnapshot).ToList();
        }

        public async Task<WhiteboardSnapshotDto> SaveWhiteboardAsync(SaveWhiteboardRequest request, CancellationToken cancellationToken = default)
        {
            var state = await GetOrCreateStateAsync(cancellationToken);
            EnsureCanUseLiveTools(state);
            ValidateWhiteboardDataUrl(request.DataUrl);

            var authorName = GetCurrentDisplayName();
            state.ChangeWhiteboardImage(request.DataUrl, authorName);

            var snapshot = new WhiteboardSnapshot(request.DataUrl, _currentUser.AccountId, authorName);
            _dbContext.WhiteboardSnapshots.Add(snapshot);
            await _dbContext.SaveChangesAsync(cancellationToken);

            var dto = MapWhiteboardSnapshot(snapshot);
            await _notifier.BroadcastAsync("whiteboard-updated", new
            {
                snapshot = dto,
                onlineClass = MapOnlineClass(state)
            }, cancellationToken);
            return dto;
        }

        public async Task<OnlineClassDto?> UseWhiteboardSnapshotAsync(string snapshotId, CancellationToken cancellationToken = default)
        {
            var state = await GetOrCreateStateAsync(cancellationToken);
            EnsureCanUseLiveTools(state);
            var snapshot = await _dbContext.WhiteboardSnapshots
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == snapshotId, cancellationToken);

            if (snapshot == null)
            {
                return null;
            }

            state.ChangeWhiteboardImage(snapshot.DataUrl, GetCurrentDisplayName());
            await _dbContext.SaveChangesAsync(cancellationToken);
            var dto = MapOnlineClass(state);
            await _notifier.BroadcastAsync("whiteboard-updated", new { onlineClass = dto, snapshotId }, cancellationToken);
            return dto;
        }

        public async Task<bool> DeleteWhiteboardSnapshotAsync(string snapshotId, CancellationToken cancellationToken = default)
        {
            RequireAdmin();
            var snapshot = await _dbContext.WhiteboardSnapshots
                .FirstOrDefaultAsync(x => x.Id == snapshotId, cancellationToken);

            if (snapshot == null)
            {
                return false;
            }

            _dbContext.WhiteboardSnapshots.Remove(snapshot);
            await _dbContext.SaveChangesAsync(cancellationToken);
            await _notifier.BroadcastAsync("whiteboard-snapshots-updated", new { snapshotId }, cancellationToken);
            return true;
        }

        public async Task<IReadOnlyList<ChatMessageDto>> GetChatMessagesAsync(string? roomId = null, CancellationToken cancellationToken = default)
        {
            if (!string.IsNullOrWhiteSpace(roomId) && !await CanAccessRoomAsync(roomId, cancellationToken))
            {
                throw new DomainException("You do not have access to this room chat");
            }

            var query = _dbContext.OnlineChatMessages.AsNoTracking();
            query = string.IsNullOrWhiteSpace(roomId)
                ? query.Where(x => x.RoomId == null)
                : query.Where(x => x.RoomId == roomId);

            var messages = await query
                .OrderByDescending(x => x.CreatedAt)
                .Take(160)
                .OrderBy(x => x.CreatedAt)
                .ToListAsync(cancellationToken);

            return messages.Select(MapChatMessage).ToList();
        }

        public async Task<ChatMessageDto> SendChatMessageAsync(SendChatMessageRequest request, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(request.RoomId))
            {
                var state = await GetOrCreateStateAsync(cancellationToken);
                EnsureCanUseLiveTools(state);
            }
            else
            {
                await EnsureCanUseRoomToolsAsync(request.RoomId, cancellationToken);
            }

            var cleanText = string.IsNullOrWhiteSpace(request.Text) ? string.Empty : request.Text.Trim();
            var cleanImageDataUrl = string.IsNullOrWhiteSpace(request.ImageDataUrl) ? null : request.ImageDataUrl.Trim();

            if (cleanText.Length > 1000)
            {
                throw new DomainException("Tin nhắn vượt quá 1000 ký tự");
            }

            if (cleanImageDataUrl?.Length > 750_000)
            {
                throw new DomainException("Hình ảnh chat quá lớn");
            }

            if (cleanImageDataUrl != null &&
                !cleanImageDataUrl.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
            {
                throw new DomainException("Định dạng hình ảnh chat không hợp lệ");
            }

            var message = new OnlineChatMessage(
                cleanText,
                _currentUser.AccountId,
                GetCurrentDisplayName(),
                _currentUser.Role ?? "User",
                request.RoomId,
                cleanImageDataUrl);

            _dbContext.OnlineChatMessages.Add(message);
            await _dbContext.SaveChangesAsync(cancellationToken);

            var dto = MapChatMessage(message);
            if (!string.IsNullOrWhiteSpace(message.RoomId))
            {
                await _notifier.BroadcastToRoomAsync(message.RoomId, "chat-message", dto, cancellationToken);
            }
            else
            {
                await _notifier.BroadcastAsync("chat-message", dto, cancellationToken);
            }
            return dto;
        }

        public async Task ClearChatMessagesAsync(string? roomId = null, CancellationToken cancellationToken = default)
        {
            RequireAdmin();
            var messagesQuery = _dbContext.OnlineChatMessages.AsQueryable();
            messagesQuery = string.IsNullOrWhiteSpace(roomId)
                ? messagesQuery.Where(x => x.RoomId == null)
                : messagesQuery.Where(x => x.RoomId == roomId);

            await messagesQuery.ExecuteDeleteAsync(cancellationToken);
            if (!string.IsNullOrWhiteSpace(roomId))
            {
                await _notifier.BroadcastToRoomAsync(roomId, "chat-cleared", new { roomId }, cancellationToken);
            }
            else
            {
                await _notifier.BroadcastAsync("chat-cleared", null, cancellationToken);
            }
        }

        public async Task<OnlineClassRoomDto> CreateRoomAsync(CreateOnlineClassRoomRequest request, CancellationToken cancellationToken = default)
        {
            RequireAdmin();
            var accountId = _currentUser.AccountId
                ?? throw new DomainException("Không xác định được tài khoản đăng nhập");

            var room = new OnlineClassRoom(
                request.Name,
                request.Description,
                accountId,
                GetCurrentDisplayName());

            _dbContext.OnlineClassRooms.Add(room);
            _dbContext.ClassRoomMembers.Add(new ClassRoomMember(room.Id, accountId, accountId));
            await _dbContext.SaveChangesAsync(cancellationToken);

            var dto = await MapRoomDtoAsync(room.Id, cancellationToken);
            await _notifier.BroadcastAsync("online-class-rooms-updated", dto, cancellationToken);
            return dto;
        }

        public async Task<OnlineClassRoomDto?> UpdateRoomAsync(
            string roomId,
            UpdateOnlineClassRoomRequest request,
            CancellationToken cancellationToken = default)
        {
            RequireAdmin();
            var room = await _dbContext.OnlineClassRooms
                .FirstOrDefaultAsync(x => x.Id == roomId, cancellationToken);

            if (room == null)
            {
                return null;
            }

            room.ChangeName(request.Name, request.Description, GetCurrentDisplayName());
            await _dbContext.SaveChangesAsync(cancellationToken);

            var dto = await MapRoomDtoAsync(room.Id, cancellationToken);
            await _notifier.BroadcastAsync("online-class-rooms-updated", dto, cancellationToken);
            return dto;
        }

        public async Task<OnlineClassRoomDto?> SetRoomLiveAsync(
            string roomId,
            bool isLive,
            CancellationToken cancellationToken = default)
        {
            RequireAdmin();
            var room = await _dbContext.OnlineClassRooms
                .FirstOrDefaultAsync(x => x.Id == roomId, cancellationToken);

            if (room == null)
            {
                return null;
            }

            room.SetLive(isLive, GetCurrentDisplayName());
            await _dbContext.SaveChangesAsync(cancellationToken);

            var dto = await MapRoomDtoAsync(room.Id, cancellationToken);
            await _notifier.BroadcastAsync("online-class-rooms-updated", dto, cancellationToken);
            return dto;
        }

        public async Task<AssignClassRoomMembersResultDto> AssignRoomMembersAsync(
            string roomId,
            AssignClassRoomMembersRequest request,
            CancellationToken cancellationToken = default)
        {
            RequireAdmin();
            var room = await _dbContext.OnlineClassRooms
                .FirstOrDefaultAsync(x => x.Id == roomId, cancellationToken)
                ?? throw new DomainException("Phòng học không tồn tại");

            var accountIds = (request.AccountIds ?? new List<int>())
                .Where(x => x > 0)
                .Distinct()
                .ToList();

            if (accountIds.Count == 0)
            {
                throw new DomainException("Danh sách học sinh không được để trống");
            }

            var studentIds = await _dbContext.Accounts
                .AsNoTracking()
                .Where(x => accountIds.Contains(x.Id) && x.Role == "User")
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);

            var existingMemberIds = await _dbContext.ClassRoomMembers
                .AsNoTracking()
                .Where(x => x.RoomId == roomId)
                .Select(x => x.AccountId)
                .ToListAsync(cancellationToken);

            var existingSet = existingMemberIds.ToHashSet();
            var assignerId = _currentUser.AccountId;
            var added = 0;
            var skipped = 0;

            foreach (var accountId in accountIds)
            {
                if (!studentIds.Contains(accountId))
                {
                    skipped += 1;
                    continue;
                }

                if (existingSet.Contains(accountId))
                {
                    skipped += 1;
                    continue;
                }

                _dbContext.ClassRoomMembers.Add(new ClassRoomMember(room.Id, accountId, assignerId));
                existingSet.Add(accountId);
                added += 1;
            }

            await _dbContext.SaveChangesAsync(cancellationToken);

            var memberAccountIds = await GetRoomStudentAccountIdsAsync(roomId, cancellationToken);
            await _notifier.BroadcastAsync("online-class-rooms-updated", await MapRoomDtoAsync(room.Id, cancellationToken), cancellationToken);

            return new AssignClassRoomMembersResultDto
            {
                RoomId = room.Id,
                AddedCount = added,
                SkippedCount = skipped,
                MemberAccountIds = memberAccountIds
            };
        }

        public async Task<AssignClassRoomMembersResultDto> ReplaceRoomMembersAsync(
            string roomId,
            AssignClassRoomMembersRequest request,
            CancellationToken cancellationToken = default)
        {
            RequireAdmin();
            var room = await _dbContext.OnlineClassRooms
                .FirstOrDefaultAsync(x => x.Id == roomId, cancellationToken)
                ?? throw new DomainException("Room not found");

            var requestedAccountIds = (request.AccountIds ?? new List<int>())
                .Where(x => x > 0)
                .Distinct()
                .ToList();

            var studentIds = await _dbContext.Accounts
                .AsNoTracking()
                .Where(x => requestedAccountIds.Contains(x.Id) && x.Role == "User")
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);

            var studentIdSet = studentIds.ToHashSet();
            var existingMembers = await _dbContext.ClassRoomMembers
                .Where(x => x.RoomId == roomId)
                .ToListAsync(cancellationToken);
            var existingAccountIds = existingMembers.Select(member => member.AccountId).ToList();

            var existingStudentIds = await _dbContext.Accounts
                .AsNoTracking()
                .Where(x => existingAccountIds.Contains(x.Id) && x.Role == "User")
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
            var existingStudentIdSet = existingStudentIds.ToHashSet();

            var membersToRemove = existingMembers
                .Where(x => existingStudentIdSet.Contains(x.AccountId) && !studentIdSet.Contains(x.AccountId))
                .ToList();
            _dbContext.ClassRoomMembers.RemoveRange(membersToRemove);

            var added = 0;
            foreach (var accountId in studentIds)
            {
                if (existingMembers.Any(x => x.AccountId == accountId))
                {
                    continue;
                }

                _dbContext.ClassRoomMembers.Add(new ClassRoomMember(room.Id, accountId, _currentUser.AccountId));
                added += 1;
            }

            await _dbContext.SaveChangesAsync(cancellationToken);

            var memberAccountIds = await GetRoomStudentAccountIdsAsync(roomId, cancellationToken);
            var result = new AssignClassRoomMembersResultDto
            {
                RoomId = room.Id,
                AddedCount = added,
                SkippedCount = requestedAccountIds.Count - studentIds.Count,
                MemberAccountIds = memberAccountIds
            };

            await _notifier.BroadcastAsync("online-class-rooms-updated", await MapRoomDtoAsync(room.Id, cancellationToken), cancellationToken);
            return result;
        }

        public async Task<bool> DeleteRoomAsync(string roomId, CancellationToken cancellationToken = default)
        {
            RequireAdmin();
            var room = await _dbContext.OnlineClassRooms
                .FirstOrDefaultAsync(x => x.Id == roomId, cancellationToken);

            if (room == null)
            {
                return false;
            }

            _dbContext.OnlineClassRooms.Remove(room);
            await _dbContext.SaveChangesAsync(cancellationToken);
            await _notifier.BroadcastAsync("online-class-rooms-updated", new { roomId, deleted = true }, cancellationToken);
            return true;
        }

        public async Task<IReadOnlyList<OnlineClassRoomDto>> GetAccessibleRoomsAsync(CancellationToken cancellationToken = default)
        {
            var accountId = _currentUser.AccountId
                ?? throw new DomainException("Không xác định được tài khoản đăng nhập");

            IQueryable<OnlineClassRoom> query = _dbContext.OnlineClassRooms.AsNoTracking();

            if (!_currentUser.IsAdmin)
            {
                var memberRoomIds = _dbContext.ClassRoomMembers
                    .AsNoTracking()
                    .Where(x => x.AccountId == accountId)
                    .Select(x => x.RoomId);

                query = query.Where(x => memberRoomIds.Contains(x.Id));
            }

            var rooms = await query
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync(cancellationToken);

            if (rooms.Count == 0)
            {
                return Array.Empty<OnlineClassRoomDto>();
            }

            var roomIds = rooms.Select(x => x.Id).ToList();
            var memberCounts = await _dbContext.ClassRoomMembers
                .AsNoTracking()
                .Where(x => roomIds.Contains(x.RoomId))
                .GroupBy(x => x.RoomId)
                .Select(x => new { RoomId = x.Key, Count = x.Count() })
                .ToDictionaryAsync(x => x.RoomId, x => x.Count, cancellationToken);

            var currentMemberRoomIds = _currentUser.IsAdmin
                ? roomIds.ToHashSet()
                : await _dbContext.ClassRoomMembers
                    .AsNoTracking()
                    .Where(x => x.AccountId == accountId && roomIds.Contains(x.RoomId))
                    .Select(x => x.RoomId)
                    .ToHashSetAsync(cancellationToken);

            var memberAccountIdsByRoom = new Dictionary<string, IReadOnlyList<int>>();
            if (_currentUser.IsAdmin)
            {
                var roomStudentPairs = await _dbContext.ClassRoomMembers
                    .AsNoTracking()
                    .Where(x => roomIds.Contains(x.RoomId))
                    .Join(
                        _dbContext.Accounts.AsNoTracking().Where(x => x.Role == "User"),
                        member => member.AccountId,
                        account => account.Id,
                        (member, account) => new { member.RoomId, account.Id })
                    .OrderBy(x => x.RoomId)
                    .ThenBy(x => x.Id)
                    .ToListAsync(cancellationToken);

                memberAccountIdsByRoom = roomStudentPairs
                    .GroupBy(x => x.RoomId)
                    .ToDictionary(
                        x => x.Key,
                        x => (IReadOnlyList<int>)x.Select(item => item.Id).ToList());
            }

            return rooms
                .Select(room =>
                {
                    memberCounts.TryGetValue(room.Id, out var memberCount);
                    memberAccountIdsByRoom.TryGetValue(room.Id, out var memberAccountIds);
                    return MapRoomDto(
                        room,
                        memberCount,
                        currentMemberRoomIds.Contains(room.Id),
                        memberAccountIds ?? Array.Empty<int>());
                })
                .ToList();
        }

        public async Task<bool> CanAccessRoomAsync(string roomId, CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(roomId))
            {
                return false;
            }

            var room = await _dbContext.OnlineClassRooms
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == roomId, cancellationToken);

            if (room == null)
            {
                return false;
            }

            if (_currentUser.IsAdmin)
            {
                return true;
            }

            var accountId = _currentUser.AccountId;
            if (!accountId.HasValue)
            {
                return false;
            }

            return room.IsLive && await _dbContext.ClassRoomMembers
                .AsNoTracking()
                .AnyAsync(x => x.RoomId == roomId && x.AccountId == accountId.Value, cancellationToken);
        }

        private async Task<OnlineClassRoomDto> MapRoomDtoAsync(
            string roomId,
            CancellationToken cancellationToken,
            OnlineClassRoom? room = null)
        {
            room ??= await _dbContext.OnlineClassRooms
                .AsNoTracking()
                .FirstAsync(x => x.Id == roomId, cancellationToken);

            var memberCount = await _dbContext.ClassRoomMembers
                .AsNoTracking()
                .CountAsync(x => x.RoomId == roomId, cancellationToken);

            var isMember = false;
            if (_currentUser.AccountId.HasValue)
            {
                isMember = _currentUser.IsAdmin || await _dbContext.ClassRoomMembers
                    .AsNoTracking()
                    .AnyAsync(
                        x => x.RoomId == roomId && x.AccountId == _currentUser.AccountId.Value,
                        cancellationToken);
            }

            IReadOnlyList<int> memberAccountIds = _currentUser.IsAdmin
                ? await GetRoomStudentAccountIdsAsync(roomId, cancellationToken)
                : Array.Empty<int>();

            return MapRoomDto(room, memberCount, isMember, memberAccountIds);
        }

        private static OnlineClassRoomDto MapRoomDto(
            OnlineClassRoom room,
            int memberCount,
            bool isMember,
            IReadOnlyList<int> memberAccountIds)
        {
            return new OnlineClassRoomDto
            {
                Id = room.Id,
                Name = room.Name,
                Description = room.Description,
                IsLive = room.IsLive,
                CreatedByAccountId = room.CreatedByAccountId,
                CreatedByName = room.CreatedByName,
                CreatedAt = room.CreatedAt,
                UpdatedAt = room.UpdatedAt,
                MemberCount = memberCount,
                IsMember = isMember,
                MemberAccountIds = memberAccountIds
            };
        }

        private async Task<IReadOnlyList<int>> GetRoomStudentAccountIdsAsync(string roomId, CancellationToken cancellationToken)
        {
            return await _dbContext.ClassRoomMembers
                .AsNoTracking()
                .Where(x => x.RoomId == roomId)
                .Join(
                    _dbContext.Accounts.AsNoTracking().Where(x => x.Role == "User"),
                    member => member.AccountId,
                    account => account.Id,
                    (member, account) => account.Id)
                .OrderBy(x => x)
                .ToListAsync(cancellationToken);
        }

        private async Task<OnlineClassState> GetOrCreateStateAsync(CancellationToken cancellationToken)
        {
            var state = await _dbContext.OnlineClassStates.FirstOrDefaultAsync(x => x.Id == 1, cancellationToken);
            if (state != null)
            {
                return state;
            }

            state = new OnlineClassState("Lớp học online", "Ôn tập, giải đáp bài và làm việc trên bảng trắng.");
            _dbContext.OnlineClassStates.Add(state);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return state;
        }

        private void RequireAdmin()
        {
            if (!_currentUser.IsAdmin)
            {
                throw new DomainException("Tài khoản này không có quyền quản trị");
            }
        }

        private void EnsureCanUseLiveTools(OnlineClassState state)
        {
            if (_currentUser.IsAdmin)
            {
                return;
            }

            if (!_currentUser.IsStudent || !state.IsLive)
            {
                throw new DomainException("Lớp online chưa mở");
            }
        }

        private async Task EnsureCanAccessRoomAsync(string classRoomId, CancellationToken cancellationToken)
        {
            if (!await CanAccessRoomAsync(classRoomId, cancellationToken))
            {
                throw new DomainException("You do not have access to this room");
            }
        }

        private async Task EnsureRoomExistsAsync(string classRoomId, CancellationToken cancellationToken)
        {
            var exists = await _dbContext.OnlineClassRooms
                .AsNoTracking()
                .AnyAsync(x => x.Id == classRoomId, cancellationToken);

            if (!exists)
            {
                throw new DomainException("Room not found");
            }
        }

        private async Task EnsureCanUseRoomToolsAsync(string roomId, CancellationToken cancellationToken)
        {
            var room = await _dbContext.OnlineClassRooms
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == roomId, cancellationToken)
                ?? throw new DomainException("Room not found");

            if (_currentUser.IsAdmin)
            {
                return;
            }

            if (!_currentUser.IsStudent || !_currentUser.AccountId.HasValue || !room.IsLive)
            {
                throw new DomainException("Room is not open");
            }

            var isMember = await _dbContext.ClassRoomMembers
                .AsNoTracking()
                .AnyAsync(x => x.RoomId == roomId && x.AccountId == _currentUser.AccountId.Value, cancellationToken);

            if (!isMember)
            {
                throw new DomainException("You do not have access to this room");
            }
        }

        private string GetCurrentDisplayName()
        {
            return _currentUser.DisplayName ?? _currentUser.Username ?? (_currentUser.IsAdmin ? "Thầy giáo" : "Học sinh");
        }

        private static (string ContentType, byte[] Content) ParsePdfDataUrl(string dataUrl)
        {
            if (string.IsNullOrWhiteSpace(dataUrl) || !dataUrl.StartsWith("data:", StringComparison.OrdinalIgnoreCase))
            {
                throw new DomainException("Dữ liệu PDF không hợp lệ");
            }

            var commaIndex = dataUrl.IndexOf(',');
            if (commaIndex <= 0)
            {
                throw new DomainException("Dữ liệu PDF không hợp lệ");
            }

            var metadata = dataUrl.Substring(5, commaIndex - 5);
            var contentType = metadata.Split(';')[0];
            if (!string.Equals(contentType, "application/pdf", StringComparison.OrdinalIgnoreCase))
            {
                throw new DomainException("Chỉ hỗ trợ tài liệu PDF");
            }

            try
            {
                return (contentType, Convert.FromBase64String(dataUrl[(commaIndex + 1)..]));
            }
            catch (FormatException)
            {
                throw new DomainException("Dữ liệu PDF không hợp lệ");
            }
        }

        private static void ValidateWhiteboardDataUrl(string dataUrl)
        {
            if (string.IsNullOrWhiteSpace(dataUrl) || !dataUrl.StartsWith("data:image/", StringComparison.OrdinalIgnoreCase))
            {
                throw new DomainException("Dữ liệu bảng trắng không hợp lệ");
            }

            if (dataUrl.Length > MaxWhiteboardDataUrlLength)
            {
                throw new DomainException("Bảng trắng quá lớn, hãy xóa bớt ảnh hoặc nét vẽ trước khi lưu");
            }
        }

        private static MaterialDto MapMaterial(ClassMaterial material)
        {
            return new MaterialDto
            {
                Id = material.Id,
                Title = material.Title,
                Description = material.Description,
                FileName = material.FileName,
                ContentType = material.ContentType,
                FileSize = material.FileSize,
                FileUrl = $"/api/materials/{material.Id}/file",
                DataUrl = string.Empty,
                CreatedByAccountId = material.CreatedByAccountId,
                CreatedByName = material.CreatedByName,
                CreatedAt = material.CreatedAt
            };
        }

        private static ClassVideoDto MapClassVideo(ClassVideoMaterial video)
        {
            return new ClassVideoDto
            {
                Id = video.Id,
                ClassRoomId = video.ClassRoomId,
                Title = video.Title,
                Description = video.Description,
                YoutubeUrl = video.YoutubeUrl,
                CreatedAt = video.CreatedAt
            };
        }

        private static OnlineClassDto MapOnlineClass(OnlineClassState state)
        {
            return new OnlineClassDto
            {
                Title = state.Title,
                Agenda = state.Agenda,
                IsLive = state.IsLive,
                WhiteboardImage = state.WhiteboardImage,
                UpdatedAt = state.UpdatedAt,
                UpdatedByName = state.UpdatedByName
            };
        }

        private static WhiteboardSnapshotDto MapWhiteboardSnapshot(WhiteboardSnapshot snapshot)
        {
            return new WhiteboardSnapshotDto
            {
                Id = snapshot.Id,
                Title = snapshot.Title,
                DataUrl = snapshot.DataUrl,
                AuthorAccountId = snapshot.AuthorAccountId,
                AuthorName = snapshot.AuthorName,
                CreatedAt = snapshot.CreatedAt
            };
        }

        private static ChatMessageDto MapChatMessage(OnlineChatMessage message)
        {
            return new ChatMessageDto
            {
                Id = message.Id,
                Text = message.Text,
                AuthorAccountId = message.AuthorAccountId,
                AuthorName = message.AuthorName,
                Role = message.Role,
                RoomId = message.RoomId,
                ImageDataUrl = message.ImageDataUrl,
                CreatedAt = message.CreatedAt
            };
        }
    }
}
