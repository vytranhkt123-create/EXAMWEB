using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.ExamAttempts
{
    public class ExamAttempt
    {
        protected ExamAttempt() { }

        public string Id { get; private set; } = string.Empty;
        public string TestId { get; private set; } = string.Empty;
        public int? AccountId { get; private set; }
        public string? MonitoringSessionId { get; private set; }
        public string TestName { get; private set; } = string.Empty;
        public string StudentName { get; private set; } = string.Empty;
        public decimal Score { get; private set; }
        public decimal ScoreTotal { get; private set; }
        public int CorrectCount { get; private set; }
        public int QuestionCount { get; private set; }
        public int? DurationSeconds { get; private set; }
        public bool IsTimeExpired { get; private set; }
        public DateTime SubmittedAt { get; private set; }

        public ExamAttempt(
            string testId,
            string testName,
            int? accountId,
            string studentName,
            decimal score,
            decimal scoreTotal,
            int correctCount,
            int questionCount,
            string? monitoringSessionId,
            int? durationSeconds,
            bool isTimeExpired)
        {
            Id = "Attempt_" + Guid.NewGuid().ToString("N");
            ChangeTestId(testId);
            AccountId = accountId;
            MonitoringSessionId = string.IsNullOrWhiteSpace(monitoringSessionId) ? null : monitoringSessionId.Trim();
            ChangeTestName(testName);
            ChangeStudentName(studentName);
            Score = score;
            ScoreTotal = scoreTotal;
            CorrectCount = correctCount;
            QuestionCount = questionCount;
            DurationSeconds = durationSeconds.HasValue ? Math.Max(0, durationSeconds.Value) : null;
            IsTimeExpired = isTimeExpired;
            SubmittedAt = DateTime.UtcNow;
        }

        private void ChangeTestId(string testId)
        {
            if (string.IsNullOrWhiteSpace(testId))
                throw new DomainException("Lượt làm bài phải thuộc một đề thi");
            TestId = testId;
        }

        private void ChangeTestName(string testName)
        {
            if (string.IsNullOrWhiteSpace(testName))
                throw new DomainException("Tên đề thi không được bỏ trống");
            TestName = testName.Trim();
        }

        private void ChangeStudentName(string studentName)
        {
            if (string.IsNullOrWhiteSpace(studentName))
                throw new DomainException("Tên học viên không được bỏ trống");
            StudentName = studentName.Trim();
        }
    }
}
