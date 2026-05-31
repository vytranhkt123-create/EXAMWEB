using ExamWeb.Domain.Entity.OnlineClasses;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace ExamWeb.Infrastructure.Data.Configurations
{
    public class OnlineClassStateConfiguration : IEntityTypeConfiguration<OnlineClassState>
    {
        public void Configure(EntityTypeBuilder<OnlineClassState> builder)
        {
            builder.ToTable("OnlineClassStates");
            builder.HasKey(x => x.Id);
            builder.Property(x => x.Id).ValueGeneratedNever();
            builder.Property(x => x.Title).IsRequired().HasMaxLength(180);
            builder.Property(x => x.Agenda).HasMaxLength(1200);
            builder.Property(x => x.IsLive).IsRequired();
            builder.Property(x => x.WhiteboardImage);
            builder.Property(x => x.UpdatedByName).HasMaxLength(120);
        }
    }
}
