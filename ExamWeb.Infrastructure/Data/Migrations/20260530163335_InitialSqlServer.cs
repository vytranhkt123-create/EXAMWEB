using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ExamWeb.Infrastructure.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialSqlServer : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
IF OBJECT_ID(N'[Test]', N'U') IS NULL
BEGIN
    CREATE TABLE [Test] (
        [Id] nvarchar(450) NOT NULL,
        [TestName] nvarchar(120) NOT NULL,
        [DurationMinutes] int NOT NULL CONSTRAINT [DF_Test_DurationMinutes] DEFAULT 30,
        [QuestionCount] int NOT NULL,
        [ScoreTotal] decimal(10,2) NOT NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_Test] PRIMARY KEY ([Id])
    );
END;

IF COL_LENGTH(N'Test', N'DurationMinutes') IS NULL
BEGIN
    ALTER TABLE [Test]
    ADD [DurationMinutes] int NOT NULL CONSTRAINT [DF_Test_DurationMinutes] DEFAULT 30;
END;

IF OBJECT_ID(N'[Questions]', N'U') IS NULL
BEGIN
    CREATE TABLE [Questions] (
        [Id] nvarchar(450) NOT NULL,
        [TestId] nvarchar(450) NOT NULL,
        [Content] nvarchar(1000) NOT NULL,
        [Score] decimal(10,2) NOT NULL,
        CONSTRAINT [PK_Questions] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Questions_Test_TestId] FOREIGN KEY ([TestId]) REFERENCES [Test] ([Id]) ON DELETE CASCADE
    );
END;

IF OBJECT_ID(N'[Answers]', N'U') IS NULL
BEGIN
    CREATE TABLE [Answers] (
        [Id] nvarchar(450) NOT NULL,
        [QuestionId] nvarchar(450) NOT NULL,
        [Content] nvarchar(600) NOT NULL,
        [IsCorrect] bit NOT NULL,
        CONSTRAINT [PK_Answers] PRIMARY KEY ([Id]),
        CONSTRAINT [FK_Answers_Questions_QuestionId] FOREIGN KEY ([QuestionId]) REFERENCES [Questions] ([Id]) ON DELETE CASCADE
    );
END;

IF OBJECT_ID(N'[ExamAttempts]', N'U') IS NULL
BEGIN
    CREATE TABLE [ExamAttempts] (
        [Id] nvarchar(450) NOT NULL,
        [TestId] nvarchar(80) NOT NULL,
        [MonitoringSessionId] nvarchar(80) NULL,
        [TestName] nvarchar(120) NOT NULL,
        [StudentName] nvarchar(120) NOT NULL,
        [Score] decimal(10,2) NOT NULL,
        [ScoreTotal] decimal(10,2) NOT NULL,
        [CorrectCount] int NOT NULL,
        [QuestionCount] int NOT NULL,
        [DurationSeconds] int NULL,
        [IsTimeExpired] bit NOT NULL,
        [SubmittedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_ExamAttempts] PRIMARY KEY ([Id])
    );
END;

IF OBJECT_ID(N'[ExamMonitorEvents]', N'U') IS NULL
BEGIN
    CREATE TABLE [ExamMonitorEvents] (
        [Id] nvarchar(450) NOT NULL,
        [TestId] nvarchar(80) NOT NULL,
        [TestName] nvarchar(120) NOT NULL,
        [SessionId] nvarchar(80) NOT NULL,
        [StudentName] nvarchar(120) NOT NULL,
        [EventType] nvarchar(50) NOT NULL,
        [Message] nvarchar(300) NULL,
        [ImageDataUrl] nvarchar(max) NULL,
        [CreatedAt] datetime2 NOT NULL,
        CONSTRAINT [PK_ExamMonitorEvents] PRIMARY KEY ([Id])
    );
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_Answers_QuestionId'
        AND [object_id] = OBJECT_ID(N'[Answers]')
)
BEGIN
    CREATE INDEX [IX_Answers_QuestionId] ON [Answers] ([QuestionId]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_Questions_TestId'
        AND [object_id] = OBJECT_ID(N'[Questions]')
)
BEGIN
    CREATE INDEX [IX_Questions_TestId] ON [Questions] ([TestId]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_ExamAttempts_TestId_SubmittedAt'
        AND [object_id] = OBJECT_ID(N'[ExamAttempts]')
)
BEGIN
    CREATE INDEX [IX_ExamAttempts_TestId_SubmittedAt] ON [ExamAttempts] ([TestId], [SubmittedAt]);
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE [name] = N'IX_ExamMonitorEvents_TestId_SessionId_CreatedAt'
        AND [object_id] = OBJECT_ID(N'[ExamMonitorEvents]')
)
BEGIN
    CREATE INDEX [IX_ExamMonitorEvents_TestId_SessionId_CreatedAt] ON [ExamMonitorEvents] ([TestId], [SessionId], [CreatedAt]);
END;
""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
IF OBJECT_ID(N'[ExamMonitorEvents]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [ExamMonitorEvents];
END;

IF OBJECT_ID(N'[ExamAttempts]', N'U') IS NOT NULL
BEGIN
    DROP TABLE [ExamAttempts];
END;

IF COL_LENGTH(N'Test', N'DurationMinutes') IS NOT NULL
BEGIN
    DECLARE @constraintName nvarchar(128);

    SELECT @constraintName = [dc].[name]
    FROM sys.default_constraints [dc]
    INNER JOIN sys.columns [c]
        ON [c].[default_object_id] = [dc].[object_id]
    INNER JOIN sys.tables [t]
        ON [t].[object_id] = [c].[object_id]
    WHERE [t].[name] = N'Test'
        AND [c].[name] = N'DurationMinutes';

    IF @constraintName IS NOT NULL
    BEGIN
        EXEC(N'ALTER TABLE [Test] DROP CONSTRAINT [' + @constraintName + N']');
    END;

    ALTER TABLE [Test] DROP COLUMN [DurationMinutes];
END;
""");
        }
    }
}
