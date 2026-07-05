using ExamWeb.Domain.DomainExceptions;
using ExamWeb.Domain.Entity.Answers;

namespace ExamWeb.Domain.Entity.Questions
{
    public class Question
    {
        protected Question() { }
        public string Id { get; private set; } = string.Empty;
        public string TestId { get; private set; } = string.Empty;
        public string Content { get; private set; } = string.Empty;
        public QuestionType QuestionType { get; private set; } = QuestionType.MultipleChoice;
        public string? ImageUrl { get; private set; }
        public decimal Score { get; private set; }
        public int OrderIndex { get; private set; }

        private readonly List<Answer> _answers = new();
        public IReadOnlyCollection<Answer> Answers => _answers.AsReadOnly();

        public Question(
            string testId,
            string content,
            decimal score,
            int orderIndex = 0,
            QuestionType questionType = QuestionType.MultipleChoice,
            string? imageUrl = null)
        {
            Id = "Question_" + Guid.NewGuid().ToString("N");
            ChangeTestId(testId);
            ChangeContent(content);
            ChangeQuestionType(questionType);
            ChangeImageUrl(imageUrl);
            ChangeScore(score);
            UpdateOrderIndex(orderIndex);
        }
        public void ChangeTestId(string testId)
        {
            if (string.IsNullOrWhiteSpace(testId)) throw new DomainException("Câu hỏi phải thuộc ít nhất 1 đề");
            TestId = testId;
        }
        public void ChangeContent(string content)
        {
            if (string.IsNullOrWhiteSpace(content)) throw new DomainException("Câu hỏi phải có nội dung");
            Content = content;
        }
        public void ChangeQuestionType(QuestionType questionType)
        {
            if (!Enum.IsDefined(questionType))
            {
                throw new DomainException("Loại câu hỏi không hợp lệ");
            }

            QuestionType = questionType;
        }
        public void ChangeImageUrl(string? imageUrl)
        {
            ImageUrl = string.IsNullOrWhiteSpace(imageUrl) ? null : imageUrl.Trim();
        }
        public void ChangeScore(decimal score)
        {
            if (score < 0) throw new DomainException("Điểm số câu hỏi không được nhỏ hơn 0");
            Score = score;
        }
        public void UpdateOrderIndex(int index)
        {
            if (index < 0) throw new DomainException("Thứ tự câu hỏi không được nhỏ hơn 0");
            OrderIndex = index;
        }
        public void AddAnswer(string content, bool isCorrect)
        {
            var orderIndex = _answers.Count == 0
                ? 0
                : _answers.Max(x => x.OrderIndex) + 1;
            AddAnswer(content, isCorrect, orderIndex);
        }
        public void AddAnswer(string content, bool isCorrect, int orderIndex)
        {
            _answers.Add(new Answer(Id, content, isCorrect, orderIndex));
        }
        public void DeleteAnswer(string answerId)
        {
            if (string.IsNullOrWhiteSpace(answerId))
                throw new DomainException("Id đáp án không được bỏ trống");
            var answer = _answers.FirstOrDefault(a => a.Id == answerId);
            if (answer == null)
                throw new DomainException("Không tìm thấy đáp án");
            _answers.Remove(answer);
        }

        public void ClearAnswers()
        {
            _answers.Clear();
        }
    }
}
