using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExamWeb.Infrastructure.Data.Migrations
{
    public partial class AddRoomScopedChat : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "RoomId",
                table: "OnlineChatMessages",
                type: "nvarchar(80)",
                maxLength: 80,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_OnlineChatMessages_RoomId_CreatedAt",
                table: "OnlineChatMessages",
                columns: new[] { "RoomId", "CreatedAt" });
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_OnlineChatMessages_RoomId_CreatedAt",
                table: "OnlineChatMessages");

            migrationBuilder.DropColumn(
                name: "RoomId",
                table: "OnlineChatMessages");
        }
    }
}
