using ExamWeb.Domain.Entity.Accounts;
using ExamWeb.Domain.Entity.Chats;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class ChatRoomConfiguration : IEntityTypeConfiguration<ChatRoom>
    {
        public void Configure(EntityTypeBuilder<ChatRoom> builder)
        {
            builder.ToTable("ChatRooms");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).HasMaxLength(80);
            builder.Property(x => x.Type)
                .HasConversion<string>()
                .IsRequired()
                .HasMaxLength(40);
            builder.Property(x => x.Title).IsRequired().HasMaxLength(180);
            builder.Property(x => x.ScopeId).HasMaxLength(100);
            builder.Property(x => x.DirectKey).HasMaxLength(80);
            builder.Property(x => x.CreatedAt).IsRequired();
            builder.HasIndex(x => x.CreatedByAccountId);
            builder.HasIndex(x => x.LastMessageAt);
            builder.HasIndex(x => x.DirectKey)
                .IsUnique()
                .HasFilter("[DirectKey] IS NOT NULL");
            builder.HasIndex(x => new { x.Type, x.ScopeId })
                .IsUnique()
                .HasFilter("[ScopeId] IS NOT NULL");

            builder.HasOne<Account>()
                .WithMany()
                .HasForeignKey(x => x.CreatedByAccountId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
