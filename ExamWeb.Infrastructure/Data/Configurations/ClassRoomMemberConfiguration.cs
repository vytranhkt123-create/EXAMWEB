using ExamWeb.Domain.Entity.OnlineClasses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class ClassRoomMemberConfiguration : IEntityTypeConfiguration<ClassRoomMember>
    {
        public void Configure(EntityTypeBuilder<ClassRoomMember> builder)
        {
            builder.ToTable("ClassRoomMembers");
            builder.HasKey(x => new { x.RoomId, x.AccountId });
            builder.Property(x => x.RoomId).IsRequired().HasMaxLength(80);
            builder.HasIndex(x => x.AccountId);

            builder.HasOne(x => x.Room)
                .WithMany(x => x.Members)
                .HasForeignKey(x => x.RoomId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
