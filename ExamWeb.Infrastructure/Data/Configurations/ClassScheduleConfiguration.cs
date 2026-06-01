using ExamWeb.Domain.Entity.Schedules;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class ClassScheduleConfiguration : IEntityTypeConfiguration<ClassSchedule>
    {
        public void Configure(EntityTypeBuilder<ClassSchedule> builder)
        {
            builder.ToTable("ClassSchedules");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).HasMaxLength(80);
            builder.Property(x => x.Title).IsRequired().HasMaxLength(180);
            builder.Property(x => x.Description).HasMaxLength(1000);
            builder.Property(x => x.StartTime).IsRequired();
            builder.Property(x => x.EndTime).IsRequired();
            builder.Property(x => x.CreatedAt).IsRequired();

            builder.HasIndex(x => x.StartTime);
            builder.HasIndex(x => x.CreatedBy);

            builder.HasMany(x => x.Attendances)
                .WithOne(x => x.Schedule)
                .HasForeignKey(x => x.ScheduleId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Navigation(x => x.Attendances)
                .UsePropertyAccessMode(PropertyAccessMode.Field);
        }
    }
}
