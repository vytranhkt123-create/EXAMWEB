using ExamWeb.Domain.Entity.OnlineClasses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class OnlineChatMessageConfiguration : IEntityTypeConfiguration<OnlineChatMessage>
    {
        public void Configure(EntityTypeBuilder<OnlineChatMessage> builder)
        {
            builder.ToTable("OnlineChatMessages");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Text).IsRequired().HasMaxLength(1000);
            builder.Property(x => x.AuthorName).IsRequired().HasMaxLength(120);
            builder.Property(x => x.Role).IsRequired().HasMaxLength(30);
            builder.Property(x => x.RoomId).HasMaxLength(80);
            builder.Property(x => x.CreatedAt).IsRequired();
            builder.HasIndex(x => x.CreatedAt);
            builder.HasIndex(x => new { x.RoomId, x.CreatedAt });
        }
    }
}
