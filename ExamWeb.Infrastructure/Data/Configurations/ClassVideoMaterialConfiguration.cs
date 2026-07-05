using ExamWeb.Domain.Entity.OnlineClasses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class ClassVideoMaterialConfiguration : IEntityTypeConfiguration<ClassVideoMaterial>
    {
        public void Configure(EntityTypeBuilder<ClassVideoMaterial> builder)
        {
            builder.ToTable("ClassVideoMaterials");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).HasMaxLength(80);
            builder.Property(x => x.ClassRoomId).IsRequired().HasMaxLength(80);
            builder.Property(x => x.Title).IsRequired().HasMaxLength(180);
            builder.Property(x => x.Description).HasMaxLength(1000);
            builder.Property(x => x.YoutubeUrl).IsRequired().HasMaxLength(500);
            builder.Property(x => x.CreatedAt).IsRequired();
            builder.HasIndex(x => new { x.ClassRoomId, x.CreatedAt });

            builder.HasOne(x => x.ClassRoom)
                .WithMany(x => x.VideoMaterials)
                .HasForeignKey(x => x.ClassRoomId)
                .OnDelete(DeleteBehavior.Cascade);
        }
    }
}
