using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.Answers
{
    public class Answer
    {
        protected Answer() { }
        public string Id { get; private set; } = string.Empty;
        public string QuestionId { get; private set; } = string.Empty;
        public string Content { get; private set; } = string.Empty;
        public bool IsCorrect { get; private set; }
        public int OrderIndex { get; private set; }

        public Answer(string questionId, string content, bool isCorrect, int orderIndex = 0)
        {
            Id = "Answer_" + Guid.NewGuid().ToString("N");
            ChangeQuestionId(questionId);
            ChangeContent(content);
            ChangeIsCorrect(isCorrect);
            UpdateOrderIndex(orderIndex);
        }
        public void ChangeQuestionId(string questionId)
        {
            if (string.IsNullOrWhiteSpace(questionId)) throw new DomainException("Đáp án phải thuộc ít nhất 1 câu hỏi");
            QuestionId = questionId;
        }
        public void ChangeContent(string content)
        {
            if (string.IsNullOrWhiteSpace(content)) throw new DomainException("Đáp án phải có nội dung");
            Content = content;
        }
        public void ChangeIsCorrect(bool isCorrect)
        {
            IsCorrect = isCorrect;
        }
        public void UpdateOrderIndex(int index)
        {
            if (index < 0) throw new DomainException("Thứ tự đáp án không được nhỏ hơn 0");
            OrderIndex = index;
        }
    }
}
