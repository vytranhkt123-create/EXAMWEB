using ExamWeb.Domain.Entity.Accounts;
using ExamWeb.Domain.Entity.Chats;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class ChatMessageConfiguration : IEntityTypeConfiguration<ChatMessage>
    {
        public void Configure(EntityTypeBuilder<ChatMessage> builder)
        {
            builder.ToTable("ChatMessages");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).HasMaxLength(80);
            builder.Property(x => x.RoomId).IsRequired().HasMaxLength(80);
            builder.Property(x => x.AuthorDisplayName).IsRequired().HasMaxLength(120);
            builder.Property(x => x.AuthorRole).IsRequired().HasMaxLength(30);
            builder.Property(x => x.Text).IsRequired().HasMaxLength(2000);
            builder.Property(x => x.CreatedAt).IsRequired();
            builder.Property(x => x.IsDeleted).IsRequired();
            builder.HasIndex(x => new { x.RoomId, x.CreatedAt });
            builder.HasIndex(x => x.AuthorAccountId);

            builder.HasOne(x => x.Room)
                .WithMany(x => x.Messages)
                .HasForeignKey(x => x.RoomId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne<Account>()
                .WithMany()
                .HasForeignKey(x => x.AuthorAccountId)
                .OnDelete(DeleteBehavior.Restrict);

            builder.HasOne<Account>()
                .WithMany()
                .HasForeignKey(x => x.DeletedByAccountId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
