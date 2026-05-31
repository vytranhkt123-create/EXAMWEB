using ExamWeb.Domain.Entity.Answers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class AnswerConfiguration : IEntityTypeConfiguration<Answer>
    {
        public void Configure(EntityTypeBuilder<Answer> builder)
        {
            builder.ToTable("Answers");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.QuestionId).IsRequired();
            builder.Property(x => x.Content).IsRequired().HasMaxLength(600);
            builder.Property(x => x.IsCorrect).IsRequired();
        }
    }
}
