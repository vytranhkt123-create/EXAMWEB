using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExamWeb.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddOnlineClassFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ClassMaterials",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    FileName = table.Column<string>(type: "nvarchar(240)", maxLength: 240, nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    FileSize = table.Column<long>(type: "bigint", nullable: false),
                    Content = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedByAccountId = table.Column<int>(type: "int", nullable: true),
                    CreatedByName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClassMaterials", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OnlineChatMessages",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Text = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: false),
                    AuthorAccountId = table.Column<int>(type: "int", nullable: true),
                    AuthorName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Role = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OnlineChatMessages", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "OnlineClassStates",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    Agenda = table.Column<string>(type: "nvarchar(1200)", maxLength: 1200, nullable: false),
                    IsLive = table.Column<bool>(type: "bit", nullable: false),
                    WhiteboardImage = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    UpdatedByName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_OnlineClassStates", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "WhiteboardSnapshots",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(450)", nullable: false),
                    Title = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: false),
                    DataUrl = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    AuthorAccountId = table.Column<int>(type: "int", nullable: true),
                    AuthorName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_WhiteboardSnapshots", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClassMaterials_CreatedAt",
                table: "ClassMaterials",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_OnlineChatMessages_CreatedAt",
                table: "OnlineChatMessages",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_WhiteboardSnapshots_CreatedAt",
                table: "WhiteboardSnapshots",
                column: "CreatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ClassMaterials");

            migrationBuilder.DropTable(
                name: "OnlineChatMessages");

            migrationBuilder.DropTable(
                name: "OnlineClassStates");

            migrationBuilder.DropTable(
                name: "WhiteboardSnapshots");
        }
    }
}
