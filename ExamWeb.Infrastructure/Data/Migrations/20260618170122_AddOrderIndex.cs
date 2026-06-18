using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExamWeb.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderIndex : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "OrderIndex",
                table: "Questions",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "OrderIndex",
                table: "Answers",
                type: "int",
                nullable: false,
                defaultValue: 0);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "OrderIndex",
                table: "Questions");

            migrationBuilder.DropColumn(
                name: "OrderIndex",
                table: "Answers");
        }
    }
}
