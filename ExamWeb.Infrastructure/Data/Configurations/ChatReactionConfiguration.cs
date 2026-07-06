using ExamWeb.Domain.Entity.Accounts;
using ExamWeb.Domain.Entity.Chats;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class ChatReactionConfiguration : IEntityTypeConfiguration<ChatReaction>
    {
        public void Configure(EntityTypeBuilder<ChatReaction> builder)
        {
            builder.ToTable("ChatReactions");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).HasMaxLength(80);
            builder.Property(x => x.MessageId).IsRequired().HasMaxLength(80);
            builder.Property(x => x.Emoji).IsRequired().HasMaxLength(32);
            builder.Property(x => x.CreatedAt).IsRequired();
            builder.HasIndex(x => new { x.MessageId, x.AccountId, x.Emoji }).IsUnique();
            builder.HasIndex(x => x.AccountId);

            builder.HasOne(x => x.Message)
                .WithMany(x => x.Reactions)
                .HasForeignKey(x => x.MessageId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne<Account>()
                .WithMany()
                .HasForeignKey(x => x.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
