using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExamWeb.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOnlineClassRooms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "OnlineClassRooms",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Name = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedByAccountId = table.Column<int>(type: "int", nullable: false),
                    CreatedByName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    IsLive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OnlineClassRooms", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ClassRoomMembers",
                columns: table => new
                {
                    RoomId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    AccountId = table.Column<int>(type: "int", nullable: false),
                    AssignedByAccountId = table.Column<int>(type: "int", nullable: true),
                    AssignedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClassRoomMembers", x => new { x.RoomId, x.AccountId });
                    table.ForeignKey(
                        name: "FK_ClassRoomMembers_OnlineClassRooms_RoomId",
                        column: x => x.RoomId,
                        principalTable: "OnlineClassRooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClassRoomMembers_AccountId",
                table: "ClassRoomMembers",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_OnlineClassRooms_CreatedAt",
                table: "OnlineClassRooms",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_OnlineClassRooms_CreatedByAccountId",
                table: "OnlineClassRooms",
                column: "CreatedByAccountId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClassRoomMembers");

            migrationBuilder.DropTable(
                name: "OnlineClassRooms");
        }
    }
}
