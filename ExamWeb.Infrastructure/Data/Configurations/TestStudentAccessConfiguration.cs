using ExamWeb.Domain.Entity.Tests;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class TestStudentAccessConfiguration : IEntityTypeConfiguration<TestStudentAccess>
    {
        public void Configure(EntityTypeBuilder<TestStudentAccess> builder)
        {
            builder.ToTable("TestStudentAccess");
            builder.HasKey(x => new { x.TestId, x.AccountId });
            builder.Property(x => x.TestId).IsRequired().HasMaxLength(80);
            builder.HasIndex(x => x.AccountId);
        }
    }
}
