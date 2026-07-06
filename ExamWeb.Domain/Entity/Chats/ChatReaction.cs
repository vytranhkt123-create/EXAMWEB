using ExamWeb.Domain.DomainExceptions;

namespace ExamWeb.Domain.Entity.Chats
{
    public class ChatReaction
    {
        protected ChatReaction() { }

        public string Id { get; private set; } = string.Empty;
        public string MessageId { get; private set; } = string.Empty;
        public int AccountId { get; private set; }
        public string Emoji { get; private set; } = string.Empty;
        public DateTime CreatedAt { get; private set; }

        public ChatMessage Message { get; private set; } = null!;

        public ChatReaction(string messageId, int accountId, string emoji)
        {
            if (string.IsNullOrWhiteSpace(messageId))
            {
                throw new DomainException("Message is invalid");
            }

            if (accountId <= 0)
            {
                throw new DomainException("Reacting account is invalid");
            }

            var cleanEmoji = string.IsNullOrWhiteSpace(emoji) ? string.Empty : emoji.Trim();
            if (cleanEmoji.Length == 0 || cleanEmoji.Length > 32)
            {
                throw new DomainException("Reaction emoji is invalid");
            }

            Id = "ChatReaction_" + Guid.NewGuid().ToString("N");
            MessageId = messageId.Trim();
            AccountId = accountId;
            Emoji = cleanEmoji;
            CreatedAt = DateTime.UtcNow;
        }
    }
}
