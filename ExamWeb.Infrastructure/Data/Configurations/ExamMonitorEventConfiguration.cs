using ExamWeb.Domain.Entity.ExamMonitorEvents;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class ExamMonitorEventConfiguration : IEntityTypeConfiguration<ExamMonitorEvent>
    {
        public void Configure(EntityTypeBuilder<ExamMonitorEvent> builder)
        {
            builder.ToTable("ExamMonitorEvents");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.TestId).IsRequired().HasMaxLength(80);
            builder.Property(x => x.TestName).IsRequired().HasMaxLength(120);
            builder.Property(x => x.SessionId).IsRequired().HasMaxLength(80);
            builder.Property(x => x.StudentName).IsRequired().HasMaxLength(120);
            builder.Property(x => x.EventType).IsRequired().HasMaxLength(50);
            builder.Property(x => x.Message).HasMaxLength(300);
            builder.Property(x => x.ImageDataUrl);
            builder.Property(x => x.CreatedAt).IsRequired();

            builder.HasIndex(x => new { x.TestId, x.SessionId, x.CreatedAt });
        }
    }
}
