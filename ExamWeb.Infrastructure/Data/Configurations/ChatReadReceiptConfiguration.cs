using ExamWeb.Domain.Entity.Accounts;
using ExamWeb.Domain.Entity.Chats;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class ChatReadReceiptConfiguration : IEntityTypeConfiguration<ChatReadReceipt>
    {
        public void Configure(EntityTypeBuilder<ChatReadReceipt> builder)
        {
            builder.ToTable("ChatReadReceipts");
            builder.HasKey(x => new { x.MessageId, x.AccountId });
            builder.Property(x => x.MessageId).HasMaxLength(80);
            builder.Property(x => x.SeenAt).IsRequired();
            builder.HasIndex(x => x.AccountId);
            builder.HasIndex(x => x.SeenAt);

            builder.HasOne(x => x.Message)
                .WithMany(x => x.ReadReceipts)
                .HasForeignKey(x => x.MessageId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne<Account>()
                .WithMany()
                .HasForeignKey(x => x.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
