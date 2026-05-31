using ExamWeb.Domain.Entity.OnlineClasses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class WhiteboardSnapshotConfiguration : IEntityTypeConfiguration<WhiteboardSnapshot>
    {
        public void Configure(EntityTypeBuilder<WhiteboardSnapshot> builder)
        {
            builder.ToTable("WhiteboardSnapshots");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Title).IsRequired().HasMaxLength(160);
            builder.Property(x => x.DataUrl).IsRequired();
            builder.Property(x => x.AuthorName).IsRequired().HasMaxLength(120);
            builder.Property(x => x.CreatedAt).IsRequired();
            builder.HasIndex(x => x.CreatedAt);
        }
    }
}
