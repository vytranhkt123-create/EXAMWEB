using ExamWeb.Domain.Entity.Questions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class QuestionConfiguration : IEntityTypeConfiguration<Question>
    {
        public void Configure(EntityTypeBuilder<Question> builder)
        {
            builder.ToTable("Questions");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.TestId).IsRequired();
            builder.Property(x => x.Content).IsRequired().HasMaxLength(1000);
            builder.Property(x => x.Score).HasPrecision(10, 2).IsRequired();
            builder.Property(x => x.OrderIndex).IsRequired();

            builder.HasMany(x => x.Answers)
                .WithOne()
                .HasForeignKey(x => x.QuestionId)
                .OnDelete(DeleteBehavior.Cascade);

            builder.Navigation(x => x.Answers)
                .UsePropertyAccessMode(PropertyAccessMode.Field);
        }
    }
}
