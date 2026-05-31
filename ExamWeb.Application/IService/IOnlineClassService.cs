using ExamWeb.Application.DTO.OnlineClass;

namespace ExamWeb.Application.IService
{
    public interface IOnlineClassService
    {
        Task<IReadOnlyList<MaterialDto>> GetMaterialsAsync(CancellationToken cancellationToken = default);
        Task<MaterialFileDto?> GetMaterialFileAsync(string materialId, CancellationToken cancellationToken = default);
        Task<MaterialDto> CreateMaterialAsync(CreateMaterialRequest request, CancellationToken cancellationToken = default);
        Task<bool> DeleteMaterialAsync(string materialId, CancellationToken cancellationToken = default);

        Task<OnlineClassDto> GetOnlineClassAsync(CancellationToken cancellationToken = default);
        Task<OnlineClassDto> UpdateOnlineClassAsync(UpdateOnlineClassRequest request, CancellationToken cancellationToken = default);
        Task<OnlineClassDto> SetLiveAsync(bool isLive, CancellationToken cancellationToken = default);

        Task<IReadOnlyList<WhiteboardSnapshotDto>> GetWhiteboardSnapshotsAsync(CancellationToken cancellationToken = default);
        Task<WhiteboardSnapshotDto> SaveWhiteboardAsync(SaveWhiteboardRequest request, CancellationToken cancellationToken = default);
        Task<OnlineClassDto?> UseWhiteboardSnapshotAsync(string snapshotId, CancellationToken cancellationToken = default);
        Task<bool> DeleteWhiteboardSnapshotAsync(string snapshotId, CancellationToken cancellationToken = default);

        Task<IReadOnlyList<ChatMessageDto>> GetChatMessagesAsync(CancellationToken cancellationToken = default);
        Task<ChatMessageDto> SendChatMessageAsync(SendChatMessageRequest request, CancellationToken cancellationToken = default);
        Task ClearChatMessagesAsync(CancellationToken cancellationToken = default);
    }
}
