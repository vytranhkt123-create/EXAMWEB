using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExamWeb.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddRealtimeChat : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ChatRooms",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Type = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    ScopeId = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    DirectKey = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    CreatedByAccountId = table.Column<int>(type: "int", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    LastMessageAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatRooms", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatRooms_Accounts_CreatedByAccountId",
                        column: x => x.CreatedByAccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ChatMessages",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    RoomId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    AuthorAccountId = table.Column<int>(type: "int", nullable: false),
                    AuthorDisplayName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    AuthorRole = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    Text = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EditedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsDeleted = table.Column<bool>(type: "bit", nullable: false),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedByAccountId = table.Column<int>(type: "int", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatMessages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatMessages_Accounts_AuthorAccountId",
                        column: x => x.AuthorAccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChatMessages_Accounts_DeletedByAccountId",
                        column: x => x.DeletedByAccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChatMessages_ChatRooms_RoomId",
                        column: x => x.RoomId,
                        principalTable: "ChatRooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChatRoomParticipants",
                columns: table => new
                {
                    RoomId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    AccountId = table.Column<int>(type: "int", nullable: false),
                    JoinedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastSeenAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatRoomParticipants", x => new { x.RoomId, x.AccountId });
                    table.ForeignKey(
                        name: "FK_ChatRoomParticipants_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChatRoomParticipants_ChatRooms_RoomId",
                        column: x => x.RoomId,
                        principalTable: "ChatRooms",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChatReactions",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    MessageId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    AccountId = table.Column<int>(type: "int", nullable: false),
                    Emoji = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatReactions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ChatReactions_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChatReactions_ChatMessages_MessageId",
                        column: x => x.MessageId,
                        principalTable: "ChatMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ChatReadReceipts",
                columns: table => new
                {
                    MessageId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    AccountId = table.Column<int>(type: "int", nullable: false),
                    SeenAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ChatReadReceipts", x => new { x.MessageId, x.AccountId });
                    table.ForeignKey(
                        name: "FK_ChatReadReceipts_Accounts_AccountId",
                        column: x => x.AccountId,
                        principalTable: "Accounts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ChatReadReceipts_ChatMessages_MessageId",
                        column: x => x.MessageId,
                        principalTable: "ChatMessages",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_AuthorAccountId",
                table: "ChatMessages",
                column: "AuthorAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_DeletedByAccountId",
                table: "ChatMessages",
                column: "DeletedByAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatMessages_RoomId_CreatedAt",
                table: "ChatMessages",
                columns: new[] { "RoomId", "CreatedAt" });

            migrationBuilder.CreateIndex(
                name: "IX_ChatReactions_AccountId",
                table: "ChatReactions",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatReactions_MessageId_AccountId_Emoji",
                table: "ChatReactions",
                columns: new[] { "MessageId", "AccountId", "Emoji" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ChatReadReceipts_AccountId",
                table: "ChatReadReceipts",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatReadReceipts_SeenAt",
                table: "ChatReadReceipts",
                column: "SeenAt");

            migrationBuilder.CreateIndex(
                name: "IX_ChatRoomParticipants_AccountId",
                table: "ChatRoomParticipants",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatRooms_CreatedByAccountId",
                table: "ChatRooms",
                column: "CreatedByAccountId");

            migrationBuilder.CreateIndex(
                name: "IX_ChatRooms_DirectKey",
                table: "ChatRooms",
                column: "DirectKey",
                unique: true,
                filter: "[DirectKey] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_ChatRooms_LastMessageAt",
                table: "ChatRooms",
                column: "LastMessageAt");

            migrationBuilder.CreateIndex(
                name: "IX_ChatRooms_Type_ScopeId",
                table: "ChatRooms",
                columns: new[] { "Type", "ScopeId" },
                unique: true,
                filter: "[ScopeId] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ChatReactions");

            migrationBuilder.DropTable(
                name: "ChatReadReceipts");

            migrationBuilder.DropTable(
                name: "ChatRoomParticipants");

            migrationBuilder.DropTable(
                name: "ChatMessages");

            migrationBuilder.DropTable(
                name: "ChatRooms");
        }
    }
}
