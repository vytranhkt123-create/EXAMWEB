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
            var materials = await _dbContext.ClassMaterials
                .AsNoTracking()
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync(cancellationToken);

            return materials.Select(MapMaterial).ToList();
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

        public async Task<IReadOnlyList<ChatMessageDto>> GetChatMessagesAsync(CancellationToken cancellationToken = default)
        {
            var messages = await _dbContext.OnlineChatMessages
                .AsNoTracking()
                .OrderByDescending(x => x.CreatedAt)
                .Take(160)
                .OrderBy(x => x.CreatedAt)
                .ToListAsync(cancellationToken);

            return messages.Select(MapChatMessage).ToList();
        }

        public async Task<ChatMessageDto> SendChatMessageAsync(SendChatMessageRequest request, CancellationToken cancellationToken = default)
        {
            var state = await GetOrCreateStateAsync(cancellationToken);
            EnsureCanUseLiveTools(state);

            if (request.Text.Length > 1000)
            {
                throw new DomainException("Tin nhắn vượt quá 1000 ký tự");
            }

            var message = new OnlineChatMessage(
                request.Text,
                _currentUser.AccountId,
                GetCurrentDisplayName(),
                _currentUser.Role ?? "User");

            _dbContext.OnlineChatMessages.Add(message);
            await _dbContext.SaveChangesAsync(cancellationToken);

            var dto = MapChatMessage(message);
            await _notifier.BroadcastAsync("chat-message", dto, cancellationToken);
            return dto;
        }

        public async Task ClearChatMessagesAsync(CancellationToken cancellationToken = default)
        {
            RequireAdmin();
            var messages = await _dbContext.OnlineChatMessages.ToListAsync(cancellationToken);
            _dbContext.OnlineChatMessages.RemoveRange(messages);
            await _dbContext.SaveChangesAsync(cancellationToken);
            await _notifier.BroadcastAsync("chat-cleared", null, cancellationToken);
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

        private string GetCurrentDisplayName()
        {
            return _currentUser.DisplayName ?? _currentUser.Username ?? (_currentUser.IsAdmin ? "Admin" : "Học sinh");
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
                DataUrl = $"data:{material.ContentType};base64,{Convert.ToBase64String(material.Content)}",
                CreatedByAccountId = material.CreatedByAccountId,
                CreatedByName = material.CreatedByName,
                CreatedAt = material.CreatedAt
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
                CreatedAt = message.CreatedAt
            };
        }
    }
}
