using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExamWeb.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddStudentProfilesAndTestAccess : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AccountId",
                table: "ExamAttempts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "ClassName",
                table: "Accounts",
                type: "nvarchar(30)",
                maxLength: 30,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Grade",
                table: "Accounts",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "TestStudentAccess",
                columns: table => new
                {
                    TestId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    AccountId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_TestStudentAccess", x => new { x.TestId, x.AccountId });
                });

            migrationBuilder.CreateIndex(
                name: "IX_ExamAttempts_AccountId",
                table: "ExamAttempts",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_TestStudentAccess_AccountId",
                table: "TestStudentAccess",
                column: "AccountId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "TestStudentAccess");

            migrationBuilder.DropIndex(
                name: "IX_ExamAttempts_AccountId",
                table: "ExamAttempts");

            migrationBuilder.DropColumn(
                name: "AccountId",
                table: "ExamAttempts");

            migrationBuilder.DropColumn(
                name: "ClassName",
                table: "Accounts");

            migrationBuilder.DropColumn(
                name: "Grade",
                table: "Accounts");
        }
    }
}
