using ExamWeb.Domain.Entity.Answers;
using ExamWeb.Domain.Entity.ExamAttempts;
using ExamWeb.Domain.Entity.Accounts;
using ExamWeb.Domain.Entity.ExamMonitorEvents;
using ExamWeb.Domain.Entity.Questions;
using ExamWeb.Domain.Entity.Tests;
using Microsoft.EntityFrameworkCore;
using System.Reflection;

namespace ExamWeb.Infrastructure.Data
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> context) : base(context) { }
        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);
            modelBuilder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
        }
        public DbSet<Account> Accounts { get; set; }
        public DbSet<TestStudentAccess> TestStudentAccesses { get; set; }
        public DbSet<Test> Tests { get; set; }
        public DbSet<Question> Questions { get; set; }
        public DbSet<Answer> Answers { get; set; }
        public DbSet<ExamAttempt> ExamAttempts { get; set; }
        public DbSet<ExamMonitorEvent> ExamMonitorEvents { get; set; }
    }
}
