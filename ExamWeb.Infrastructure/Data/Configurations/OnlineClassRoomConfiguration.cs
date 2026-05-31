using ExamWeb.Domain.Entity.OnlineClasses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class OnlineClassRoomConfiguration : IEntityTypeConfiguration<OnlineClassRoom>
    {
        public void Configure(EntityTypeBuilder<OnlineClassRoom> builder)
        {
            builder.ToTable("OnlineClassRooms");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).HasMaxLength(80);
            builder.Property(x => x.Name).IsRequired().HasMaxLength(180);
            builder.Property(x => x.Description).HasMaxLength(1000);
            builder.Property(x => x.CreatedByName).IsRequired().HasMaxLength(120);
            builder.Property(x => x.IsLive).IsRequired();
            builder.Property(x => x.CreatedAt).IsRequired();
            builder.HasIndex(x => x.CreatedByAccountId);
            builder.HasIndex(x => x.CreatedAt);
        }
    }
}
