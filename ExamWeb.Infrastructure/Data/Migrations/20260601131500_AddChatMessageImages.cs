using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExamWeb.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddChatMessageImages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ImageDataUrl",
                table: "OnlineChatMessages",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ImageDataUrl",
                table: "OnlineChatMessages");
        }
    }
}
