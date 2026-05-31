using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.Tests
{
    public class TestStudentAccess
    {
        protected TestStudentAccess() { }

        public string TestId { get; private set; } = string.Empty;
        public int AccountId { get; private set; }

        public TestStudentAccess(string testId, int accountId)
        {
            if (string.IsNullOrWhiteSpace(testId))
            {
                throw new DomainException("Đề thi không hợp lệ");
            }

            if (accountId <= 0)
            {
                throw new DomainException("Học sinh không hợp lệ");
            }

            TestId = testId;
            AccountId = accountId;
        }
    }
}
