using ExamWeb.Domain.Entity.Accounts;
using ExamWeb.Domain.Entity.Chats;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class ChatRoomParticipantConfiguration : IEntityTypeConfiguration<ChatRoomParticipant>
    {
        public void Configure(EntityTypeBuilder<ChatRoomParticipant> builder)
        {
            builder.ToTable("ChatRoomParticipants");
            builder.HasKey(x => new { x.RoomId, x.AccountId });
            builder.Property(x => x.RoomId).HasMaxLength(80);
            builder.Property(x => x.JoinedAt).IsRequired();
            builder.HasIndex(x => x.AccountId);

            builder.HasOne(x => x.Room)
                .WithMany(x => x.Participants)
                .HasForeignKey(x => x.RoomId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.HasOne<Account>()
                .WithMany()
                .HasForeignKey(x => x.AccountId)
                .OnDelete(DeleteBehavior.Restrict);
        }
    }
}
