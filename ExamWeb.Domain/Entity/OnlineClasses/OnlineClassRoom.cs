using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.OnlineClasses
{
    public class OnlineClassRoom
    {
        protected OnlineClassRoom() { }

        public string Id { get; private set; } = string.Empty;
        public string Name { get; private set; } = string.Empty;
        public string? Description { get; private set; }
        public int CreatedByAccountId { get; private set; }
        public string CreatedByName { get; private set; } = string.Empty;
        public bool IsLive { get; private set; }
        public DateTime CreatedAt { get; private set; }
        public DateTime? UpdatedAt { get; private set; }

        public ICollection<ClassRoomMember> Members { get; private set; } = new List<ClassRoomMember>();

        public OnlineClassRoom(string name, string? description, int createdByAccountId, string createdByName)
        {
            Id = "Room_" + Guid.NewGuid().ToString("N");
            ChangeName(name);
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
            CreatedByAccountId = createdByAccountId;
            CreatedByName = string.IsNullOrWhiteSpace(createdByName) ? "Admin" : createdByName.Trim();
            CreatedAt = DateTime.UtcNow;
            IsLive = false;
        }

        public void ChangeName(string name, string? description, string updatedByName)
        {
            ChangeName(name);
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
            Touch(updatedByName);
        }

        public void SetLive(bool isLive, string updatedByName)
        {
            IsLive = isLive;
            Touch(updatedByName);
        }

        private void ChangeName(string name)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                throw new DomainException("Tên phòng học không được bỏ trống");
            }

            Name = name.Trim();
        }

        private void Touch(string _)
        {
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
