using ExamWeb.Domain.Entity.Schedules;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class ScheduleAttendanceConfiguration : IEntityTypeConfiguration<ScheduleAttendance>
    {
        public void Configure(EntityTypeBuilder<ScheduleAttendance> builder)
        {
            builder.ToTable("ScheduleAttendances");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).HasMaxLength(80);
            builder.Property(x => x.ScheduleId).IsRequired().HasMaxLength(80);
            builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
            builder.Property(x => x.Reason).HasMaxLength(500);
            builder.Property(x => x.UpdatedAt).IsRequired();

            builder.HasIndex(x => x.AccountId);
            builder.HasIndex(x => x.Status);
            builder.HasIndex(x => x.UpdatedAt);
            builder.HasIndex(x => new { x.ScheduleId, x.AccountId }).IsUnique();
        }
    }
}
