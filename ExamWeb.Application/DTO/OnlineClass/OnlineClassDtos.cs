namespace ExamWeb.Application.DTO.OnlineClass
{
    public class MaterialDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public long FileSize { get; set; }
        public string FileUrl { get; set; } = string.Empty;
        public string DataUrl { get; set; } = string.Empty;
        public int? CreatedByAccountId { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class MaterialFileDto
    {
        public string FileName { get; set; } = string.Empty;
        public string ContentType { get; set; } = string.Empty;
        public byte[] Content { get; set; } = Array.Empty<byte>();
    }

    public class CreateMaterialRequest
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string FileName { get; set; } = string.Empty;
        public string DataUrl { get; set; } = string.Empty;
    }

    public class OnlineClassDto
    {
        public string Title { get; set; } = string.Empty;
        public string Agenda { get; set; } = string.Empty;
        public bool IsLive { get; set; }
        public string? WhiteboardImage { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public string? UpdatedByName { get; set; }
    }

    public class UpdateOnlineClassRequest
    {
        public string Title { get; set; } = string.Empty;
        public string Agenda { get; set; } = string.Empty;
    }

    public class SetOnlineClassLiveRequest
    {
        public bool IsLive { get; set; }
    }

    public class SaveWhiteboardRequest
    {
        public string DataUrl { get; set; } = string.Empty;
    }

    public class WhiteboardSnapshotDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string DataUrl { get; set; } = string.Empty;
        public int? AuthorAccountId { get; set; }
        public string AuthorName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class ChatMessageDto
    {
        public string Id { get; set; } = string.Empty;
        public string Text { get; set; } = string.Empty;
        public int? AuthorAccountId { get; set; }
        public string AuthorName { get; set; } = string.Empty;
        public string Role { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
    }

    public class SendChatMessageRequest
    {
        public string Text { get; set; } = string.Empty;
    }

    public class OnlineClassRoomDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
        public bool IsLive { get; set; }
        public int CreatedByAccountId { get; set; }
        public string CreatedByName { get; set; } = string.Empty;
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public int MemberCount { get; set; }
        public bool IsMember { get; set; }
    }

    public class CreateOnlineClassRoomRequest
    {
        public string Name { get; set; } = string.Empty;
        public string? Description { get; set; }
    }

    public class AssignClassRoomMembersRequest
    {
        public List<int> AccountIds { get; set; } = new();
    }

    public class AssignClassRoomMembersResultDto
    {
        public string RoomId { get; set; } = string.Empty;
        public int AddedCount { get; set; }
        public int SkippedCount { get; set; }
        public IReadOnlyList<int> MemberAccountIds { get; set; } = Array.Empty<int>();
    }
}
