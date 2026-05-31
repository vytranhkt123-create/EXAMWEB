using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.OnlineClasses
{
    public class ClassRoomMember
    {
        protected ClassRoomMember() { }

        public string RoomId { get; private set; } = string.Empty;
        public int AccountId { get; private set; }
        public int? AssignedByAccountId { get; private set; }
        public DateTime AssignedAt { get; private set; }

        public OnlineClassRoom Room { get; private set; } = null!;

        public ClassRoomMember(string roomId, int accountId, int? assignedByAccountId)
        {
            if (string.IsNullOrWhiteSpace(roomId))
            {
                throw new DomainException("Phòng học không hợp lệ");
            }

            if (accountId <= 0)
            {
                throw new DomainException("Học sinh không hợp lệ");
            }

            RoomId = roomId;
            AccountId = accountId;
            AssignedByAccountId = assignedByAccountId;
            AssignedAt = DateTime.UtcNow;
        }
    }
}
