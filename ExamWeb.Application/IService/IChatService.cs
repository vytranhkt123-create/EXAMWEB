using ExamWeb.Application.DTO.Chat;

namespace ExamWeb.Application.IService
{
    public interface IChatService
    {
        Task<IReadOnlyList<ChatContactDto>> GetContactsAsync(CancellationToken cancellationToken = default);
        Task<IReadOnlyList<ChatRoomDto>> GetRoomsAsync(CancellationToken cancellationToken = default);
        Task<ChatRoomDto> GetOrCreateDirectRoomAsync(CreateDirectChatRequest request, CancellationToken cancellationToken = default);
        Task<ChatRoomDto> GetOrCreateScopedRoomAsync(CreateScopedChatRoomRequest request, CancellationToken cancellationToken = default);
        Task<ChatHistoryPageDto> GetMessagesAsync(string roomId, ChatHistoryQuery query, CancellationToken cancellationToken = default);
        Task<ChatMessageDto> SendMessageAsync(SendChatRequest request, ChatActorDto? actor = null, CancellationToken cancellationToken = default);
        Task<ChatMessageDto?> EditMessageAsync(string messageId, UpdateChatMessageRequest request, ChatActorDto? actor = null, CancellationToken cancellationToken = default);
        Task<ChatMessageDto?> SoftDeleteMessageAsync(string messageId, ChatActorDto? actor = null, CancellationToken cancellationToken = default);
        Task<ChatMessageDto?> ToggleReactionAsync(string messageId, ReactToMessageRequest request, ChatActorDto? actor = null, CancellationToken cancellationToken = default);
        Task<ChatReadDto> MarkReadAsync(string roomId, MarkChatReadRequest request, ChatActorDto? actor = null, CancellationToken cancellationToken = default);
        Task<bool> CanAccessRoomAsync(string roomId, ChatActorDto? actor = null, CancellationToken cancellationToken = default);
    }
}
