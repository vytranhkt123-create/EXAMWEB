using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExamWeb.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddAccounts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
IF OBJECT_ID(N'[Accounts]', N'U') IS NULL
BEGIN
    CREATE TABLE [Accounts] (
        [Id] int NOT NULL IDENTITY,
        [Username] nvarchar(80) NOT NULL,
        [DisplayName] nvarchar(120) NOT NULL,
        [Role] nvarchar(30) NOT NULL,
        [PasswordHash] nvarchar(max) NOT NULL,
        CONSTRAINT [PK_Accounts] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_Accounts_Username'
        AND [object_id] = OBJECT_ID(N'[Accounts]')
)
BEGIN
    CREATE UNIQUE INDEX [IX_Accounts_Username] ON [Accounts] ([Username]);
END;
""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
IF OBJECT_ID(N'[Accounts]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [Accounts];
END;
""");
        }
    }
}
