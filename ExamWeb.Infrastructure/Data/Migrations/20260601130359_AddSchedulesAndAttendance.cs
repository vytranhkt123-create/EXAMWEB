using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExamWeb.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddSchedulesAndAttendance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ClassSchedules",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    Title = table.Column<string>(type: "nvarchar(180)", maxLength: 180, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    StartTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndTime = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedBy = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ClassSchedules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ScheduleAttendances",
                columns: table => new
                {
                    Id = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    ScheduleId = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: false),
                    AccountId = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ScheduleAttendances", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ScheduleAttendances_ClassSchedules_ScheduleId",
                        column: x => x.ScheduleId,
                        principalTable: "ClassSchedules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ClassSchedules_CreatedBy",
                table: "ClassSchedules",
                column: "CreatedBy");

            migrationBuilder.CreateIndex(
                name: "IX_ClassSchedules_StartTime",
                table: "ClassSchedules",
                column: "StartTime");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleAttendances_AccountId",
                table: "ScheduleAttendances",
                column: "AccountId");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleAttendances_ScheduleId_AccountId",
                table: "ScheduleAttendances",
                columns: new[] { "ScheduleId", "AccountId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleAttendances_Status",
                table: "ScheduleAttendances",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_ScheduleAttendances_UpdatedAt",
                table: "ScheduleAttendances",
                column: "UpdatedAt");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ScheduleAttendances");

            migrationBuilder.DropTable(
                name: "ClassSchedules");
        }
    }
}
