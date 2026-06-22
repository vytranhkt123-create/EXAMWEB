using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExamWeb.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAllowPracticeMode : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AllowPracticeMode",
                table: "Test",
                type: "bit",
                nullable: false,
                defaultValue: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AllowPracticeMode",
                table: "Test");
        }
    }
}
