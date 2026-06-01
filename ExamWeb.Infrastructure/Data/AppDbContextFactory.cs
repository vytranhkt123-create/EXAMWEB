using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace ExamWeb.Infrastructure.Data
{
    public class AppDbContextFactory : IDesignTimeDbContextFactory<AppDbContext>
    {
        public AppDbContext CreateDbContext(string[] args)
        {
            var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__DefaultConnectionString")
                ?? "Server=(localdb)\\mssqllocaldb;Database=ExamWebDesignTime;Trusted_Connection=True;MultipleActiveResultSets=true;TrustServerCertificate=True";

            var optionsBuilder = new DbContextOptionsBuilder<AppDbContext>();
            optionsBuilder.UseSqlServer(connectionString, sqlOptions => sqlOptions.EnableRetryOnFailure());

            return new AppDbContext(optionsBuilder.Options);
        }
    }
}
