using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.Chats
{
    public class ChatReadReceipt
    {
        protected ChatReadReceipt() { }

        public string MessageId { get; private set; } = string.Empty;
        public int AccountId { get; private set; }
        public DateTime SeenAt { get; private set; }

        public ChatMessage Message { get; private set; } = null!;

        public ChatReadReceipt(string messageId, int accountId, DateTime seenAt)
        {
            if (string.IsNullOrWhiteSpace(messageId))
            {
                throw new DomainException("Message is invalid");
            }

            if (accountId <= 0)
            {
                throw new DomainException("Reader account is invalid");
            }

            MessageId = messageId.Trim();
            AccountId = accountId;
            SeenAt = seenAt;
        }

        public void MarkSeen(DateTime seenAt)
        {
            if (seenAt > SeenAt)
            {
                SeenAt = seenAt;
            }
        }
    }
}
