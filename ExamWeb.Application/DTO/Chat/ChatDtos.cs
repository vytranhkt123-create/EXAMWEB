namespace ExamWeb.Application.DTO.Chat
{
    public class ChatActorDto
    {
        public int AccountId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
    }

    public class ChatContactDto
    {
        public int AccountId { get; set; }
        public string Username { get; set; } = string.Empty;
        public string DisplayName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public string? Grade { get; set; }
        public string? ClassName { get; set; }
        public string AvatarText { get; set; } = string.Empty;
    }

    public class ChatRoomDto
    {
        public string Id { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string? ScopeId { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? LastMessageAt { get; set; }
        public int UnreadCount { get; set; }
        public IReadOnlyList<ChatParticipantDto> Participants { get; set; } = Array.Empty<ChatParticipantDto>();
        public ChatMessageDto? LastMessage { get; set; }
    }

    public class ChatParticipantDto
    {
        public int AccountId { get; set; }
        public string DisplayName { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public DateTime JoinedAt { get; set; }
        public DateTime? LastSeenAt { get; set; }
    }

    public class ChatMessageDto
    {
        public string Id { get; set; } = string.Empty;
        public string RoomId { get; set; } = string.Empty;
        public int AuthorAccountId { get; set; }
        public string AuthorDisplayName { get; set; } = string.Empty;
        public string AuthorRole { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? EditedAt { get; set; }
        public bool IsDeleted { get; set; }
        public DateTime? DeletedAt { get; set; }
        public int? DeletedByAccountId { get; set; }
        public IReadOnlyList<ChatReactionSummaryDto> Reactions { get; set; } = Array.Empty<ChatReactionSummaryDto>();
        public IReadOnlyList<ChatReadReceiptDto> ReadReceipts { get; set; } = Array.Empty<ChatReadReceiptDto>();
    }

    public class ChatReactionSummaryDto
    {
        public string Emoji { get; set; } = string.Empty;
        public int Count { get; set; }
        public bool IsMine { get; set; }
        public IReadOnlyList<int> AccountIds { get; set; } = Array.Empty<int>();
    }

    public class ChatReadReceiptDto
    {
        public int AccountId { get; set; }
        public DateTime SeenAt { get; set; }
    }

    public class ChatHistoryPageDto
    {
        public string RoomId { get; set; } = string.Empty;
        public IReadOnlyList<ChatMessageDto> Messages { get; set; } = Array.Empty<ChatMessageDto>();
        public DateTime? NextBefore { get; set; }
        public bool HasMore { get; set; }
    }

    public class ChatPresenceDto
    {
        public int AccountId { get; set; }
        public string DisplayName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public bool IsOnline { get; set; }
        public DateTime ChangedAt { get; set; }
    }

    public class ChatTypingDto
    {
        public string RoomId { get; set; } = string.Empty;
        public int AccountId { get; set; }
        public string DisplayName { get; set; } = string.Empty;
        public bool IsTyping { get; set; }
    }

    public class ChatReadDto
    {
        public string RoomId { get; set; } = string.Empty;
        public int AccountId { get; set; }
        public string? LastMessageId { get; set; }
        public DateTime SeenAt { get; set; }
    }

    public class ChatHistoryQuery
    {
        public DateTime? Before { get; set; }
        public int PageSize { get; set; } = 40;
    }

    public class CreateDirectChatRequest
    {
        public int TargetAccountId { get; set; }
    }

    public class CreateScopedChatRoomRequest
    {
        public string ScopeType { get; set; } = string.Empty;
        public string ScopeId { get; set; } = string.Empty;
    }

    public class SendChatRequest
    {
        public string RoomId { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
    }

    public class UpdateChatMessageRequest
    {
        public string Text { get; set; } = string.Empty;
    }

    public class ReactToMessageRequest
    {
        public string Emoji { get; set; } = string.Empty;
    }

    public class MarkChatReadRequest
    {
        public string? LastMessageId { get; set; }
    }
}
