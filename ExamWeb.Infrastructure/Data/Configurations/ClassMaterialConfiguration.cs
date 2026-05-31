using ExamWeb.Domain.Entity.OnlineClasses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class ClassMaterialConfiguration : IEntityTypeConfiguration<ClassMaterial>
    {
        public void Configure(EntityTypeBuilder<ClassMaterial> builder)
        {
            builder.ToTable("ClassMaterials");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Title).IsRequired().HasMaxLength(180);
            builder.Property(x => x.Description).HasMaxLength(1000);
            builder.Property(x => x.FileName).IsRequired().HasMaxLength(240);
            builder.Property(x => x.ContentType).IsRequired().HasMaxLength(80);
            builder.Property(x => x.FileSize).IsRequired();
            builder.Property(x => x.Content).IsRequired();
            builder.Property(x => x.CreatedByName).IsRequired().HasMaxLength(120);
            builder.Property(x => x.CreatedAt).IsRequired();
            builder.HasIndex(x => x.CreatedAt);
        }
    }
}
