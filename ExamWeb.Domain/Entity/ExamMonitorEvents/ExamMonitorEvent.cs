using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.ExamMonitorEvents
{
    public class ExamMonitorEvent
    {
        protected ExamMonitorEvent() { }

        public string Id { get; private set; } = string.Empty;
        public string TestId { get; private set; } = string.Empty;
        public string TestName { get; private set; } = string.Empty;
        public string SessionId { get; private set; } = string.Empty;
        public string StudentName { get; private set; } = string.Empty;
        public string EventType { get; private set; } = string.Empty;
        public string? Message { get; private set; }
        public string? ImageDataUrl { get; private set; }
        public DateTime CreatedAt { get; private set; }

        public ExamMonitorEvent(
            string testId,
            string testName,
            string sessionId,
            string studentName,
            string eventType,
            string? message,
            string? imageDataUrl)
        {
            Id = "Monitor_" + Guid.NewGuid().ToString("N");
            ChangeTestId(testId);
            ChangeTestName(testName);
            ChangeSessionId(sessionId);
            ChangeStudentName(studentName);
            ChangeEventType(eventType);
            Message = string.IsNullOrWhiteSpace(message) ? null : message.Trim();
            ImageDataUrl = string.IsNullOrWhiteSpace(imageDataUrl) ? null : imageDataUrl;
            CreatedAt = DateTime.UtcNow;
        }

        private void ChangeTestId(string testId)
        {
            if (string.IsNullOrWhiteSpace(testId))
                throw new DomainException("Sự kiện theo dõi phải thuộc một đề thi");
            TestId = testId;
        }

        private void ChangeTestName(string testName)
        {
            if (string.IsNullOrWhiteSpace(testName))
                throw new DomainException("Tên đề thi không được bỏ trống");
            TestName = testName.Trim();
        }

        private void ChangeSessionId(string sessionId)
        {
            if (string.IsNullOrWhiteSpace(sessionId))
                throw new DomainException("Phiên theo dõi không được bỏ trống");
            SessionId = sessionId.Trim();
        }

        private void ChangeStudentName(string studentName)
        {
            if (string.IsNullOrWhiteSpace(studentName))
                throw new DomainException("Tên học sinh không được bỏ trống");
            StudentName = studentName.Trim();
        }

        private void ChangeEventType(string eventType)
        {
            if (string.IsNullOrWhiteSpace(eventType))
                throw new DomainException("Loại sự kiện theo dõi không được bỏ trống");
            EventType = eventType.Trim();
        }
    }
}
