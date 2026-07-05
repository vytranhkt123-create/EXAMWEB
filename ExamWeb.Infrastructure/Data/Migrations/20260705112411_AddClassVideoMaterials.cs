using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExamWeb.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddClassVideoMaterials : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ClassVideoMaterials",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    ClassRoomId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    YoutubeUrl = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClassVideoMaterials", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ClassVideoMaterials_OnlineClassRooms_ClassRoomId",
                        column: x => x.ClassRoomId,
                        principalTable: "OnlineClassRooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClassVideoMaterials_ClassRoomId_CreatedAt",
                table: "ClassVideoMaterials",
                columns: new[] { "ClassRoomId", "CreatedAt" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClassVideoMaterials");
        }
    }
}
