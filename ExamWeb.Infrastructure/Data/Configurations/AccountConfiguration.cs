using ExamWeb.Domain.Entity.Accounts;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class AccountConfiguration : IEntityTypeConfiguration<Account>
    {
        public void Configure(EntityTypeBuilder<Account> builder)
        {
            builder.ToTable("Accounts");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Username).IsRequired().HasMaxLength(80);
            builder.Property(x => x.DisplayName).IsRequired().HasMaxLength(120);
            builder.Property(x => x.Role).IsRequired().HasMaxLength(30);
            builder.Property(x => x.PasswordHash).IsRequired();
            builder.Property(x => x.Grade).HasMaxLength(20);
            builder.Property(x => x.ClassName).HasMaxLength(30);
            builder.HasIndex(x => x.Username).IsUnique();
        }
    }
}
