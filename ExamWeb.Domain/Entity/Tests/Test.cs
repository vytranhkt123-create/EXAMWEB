using ExamWeb.Domain.DomainExceptions;
using ExamWeb.Domain.Entity.Questions;

namespace ExamWeb.Domain.Entity.Tests
{
    public class Test
    {
        protected Test() { }
        public string Id { get; private set; } = string.Empty;
        public string TestName { get; private set; } = string.Empty;
        public string? OnlineClassRoomId { get; private set; }
        public int DurationMinutes { get; private set; } = 30;
        public int QuestionCount { get; private set; } = 0;
        public decimal ScoreTotal { get; private set; } = 0;
        public bool AllowPracticeMode { get; private set; } = true;
        public DateTime CreatedAt { get; private set; }

        private readonly List<Question> _questions = new();
        public IReadOnlyCollection<Question> Questions => _questions.AsReadOnly();

        public Test(string testName, int durationMinutes = 30, bool allowPracticeMode = true, string? onlineClassRoomId = null)
        {
            Id = "Test_" + Guid.NewGuid().ToString("N");
            ChangeTestName(testName);
            ChangeOnlineClassRoom(onlineClassRoomId);
            ChangeDurationMinutes(durationMinutes);
            ChangeAllowPracticeMode(allowPracticeMode);
            ChangeScoreTotal();
            CreatedAt = DateTime.UtcNow;
        }
        public void ChangeTestName(string testName)
        {
            if (string.IsNullOrWhiteSpace(testName)) throw new DomainException("Tên đề thi không được bỏ trống");
            TestName = testName;
        }
        public void ChangeOnlineClassRoom(string? onlineClassRoomId)
        {
            OnlineClassRoomId = string.IsNullOrWhiteSpace(onlineClassRoomId) ? null : onlineClassRoomId.Trim();
        }
        public void ChangeDurationMinutes(int durationMinutes)
        {
            if (durationMinutes < 1 || durationMinutes > 240)
                throw new DomainException("Thời gian làm bài phải từ 1 đến 240 phút");
            DurationMinutes = durationMinutes;
        }
        public void ChangeAllowPracticeMode(bool allowPracticeMode)
        {
            AllowPracticeMode = allowPracticeMode;
        }
        public void ChangeScoreTotal()
        {
            ScoreTotal = _questions.Sum(q => q.Score);
        }
        public void ChangeQuestionCount()
        {
            QuestionCount = _questions.Count;
        }
        public Question AddQuestion(string content, decimal score)
        {
            var orderIndex = _questions.Count == 0
                ? 0
                : _questions.Max(x => x.OrderIndex) + 1;
            return AddQuestion(content, score, orderIndex);
        }
        public Question AddQuestion(string content, decimal score, int orderIndex)
        {
            var question = new Question(Id, content, score, orderIndex);
            _questions.Add(question);
            ChangeScoreTotal();
            ChangeQuestionCount();
            return question;
        }
        public void DeleteQuestion(string questionId)
        {
            if (string.IsNullOrWhiteSpace(questionId))
                throw new DomainException("Id câu hỏi không được bỏ trống");
            var question = _questions.FirstOrDefault(q => q.Id == questionId);
            if (question == null)
                throw new DomainException("Không tìm thấy câu hỏi");
            _questions.Remove(question);
            ChangeScoreTotal();
            ChangeQuestionCount();
        }
        public void UpdateTestSummary()
        {
            ChangeQuestionCount();
            ChangeScoreTotal();
        }
    }
}
