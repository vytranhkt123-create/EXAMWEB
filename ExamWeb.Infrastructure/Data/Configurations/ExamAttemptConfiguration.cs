using ExamWeb.Domain.Entity.ExamAttempts;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class ExamAttemptConfiguration : IEntityTypeConfiguration<ExamAttempt>
    {
        public void Configure(EntityTypeBuilder<ExamAttempt> builder)
        {
            builder.ToTable("ExamAttempts");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.TestId).IsRequired().HasMaxLength(80);
            builder.Property(x => x.AccountId);
            builder.Property(x => x.MonitoringSessionId).HasMaxLength(80);
            builder.HasIndex(x => x.AccountId);
            builder.Property(x => x.TestName).IsRequired().HasMaxLength(120);
            builder.Property(x => x.StudentName).IsRequired().HasMaxLength(120);
            builder.Property(x => x.Score).HasPrecision(10, 2).IsRequired();
            builder.Property(x => x.ScoreTotal).HasPrecision(10, 2).IsRequired();
            builder.Property(x => x.CorrectCount).IsRequired();
            builder.Property(x => x.QuestionCount).IsRequired();
            builder.Property(x => x.DurationSeconds);
            builder.Property(x => x.IsTimeExpired).IsRequired();
            builder.Property(x => x.SubmittedAt).IsRequired();

            builder.HasIndex(x => new { x.TestId, x.SubmittedAt });
        }
    }
}
