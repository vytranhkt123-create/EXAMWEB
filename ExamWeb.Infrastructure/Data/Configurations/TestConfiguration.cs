using ExamWeb.Domain.Entity.Tests;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class TestConfiguration : IEntityTypeConfiguration<Test>
    {
        public void Configure(EntityTypeBuilder<Test> builder)
        {
            builder.ToTable("Test");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.TestName).IsRequired().HasMaxLength(120);
            builder.Property(x => x.OnlineClassRoomId).HasMaxLength(80);
            builder.Property(x => x.DurationMinutes).IsRequired().HasDefaultValue(30);
            builder.Property(x => x.AllowPracticeMode).IsRequired().HasDefaultValue(true);
            builder.Property(x => x.QuestionCount).IsRequired();
            builder.Property(x => x.ScoreTotal).HasPrecision(10, 2).IsRequired();
            builder.Property(x => x.CreatedAt).IsRequired();

            builder.HasMany(x => x.Questions)
                .WithOne()
                .HasForeignKey(x => x.TestId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Navigation(x => x.Questions)
                .UsePropertyAccessMode(PropertyAccessMode.Field);

            builder.HasIndex(x => x.OnlineClassRoomId);
        }
    }
}
