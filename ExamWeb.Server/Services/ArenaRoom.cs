using System.Collections.Concurrent;

namespace ExamWeb.Server.Services
{
    public class ArenaAnswerDto
    {
        public string Id { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public bool IsCorrect { get; set; }
        public int OrderIndex { get; set; }
    }

    public class ArenaQuestionDto
    {
        public string Id { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
        public string QuestionType { get; set; } = "MultipleChoice";
        public string? ImageUrl { get; set; }
        public decimal Score { get; set; }
        public int OrderIndex { get; set; }
        public List<ArenaAnswerDto> Answers { get; set; } = new();
    }

    public class ArenaPlayer
    {
        public string ConnectionId { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public decimal Score { get; set; } = 0;
        public bool IsHost { get; set; } = false;
        public bool HasAnswered { get; set; } = false;
        public string? SelectedAnswerId { get; set; }
        public int ScoreDelta { get; set; } = 0;
        public bool? LastAnswerCorrect { get; set; }
        public int Streak { get; set; } = 0;
        public int SpeedBonus { get; set; } = 0;
        public int StreakBonus { get; set; } = 0;
        public int? LastAnswerMs { get; set; }
    }

    public class ArenaRoom
    {
        public const string PhaseLobby = "Lobby";
        public const string PhaseCountdown = "Countdown";
        public const string PhaseInGame = "InGame";
        public const string PhaseResult = "Result";
        public const string PhasePodium = "Podium";

        public string RoomId { get; set; } = string.Empty; // 6-digit PIN
        public string TestId { get; set; } = string.Empty;
        public string TestName { get; set; } = string.Empty;
        public List<ArenaQuestionDto> Questions { get; set; } = new();
        public int CurrentQuestionIndex { get; set; } = -1; // -1 = Lobby, 0+ = question active
        public string Phase { get; set; } = PhaseLobby;
        public ConcurrentDictionary<string, ArenaPlayer> Players { get; } = new();
        public string HostConnectionId { get; set; } = string.Empty;
        public DateTime? QuestionStartTime { get; set; }
        public DateTime? QuestionEndsAt { get; set; }
        public DateTime? CountdownEndsAt { get; set; }
        public int CountdownSeconds { get; set; } = 3;
        public int QuestionDurationSeconds { get; set; } = 20;
        public bool IsClosed { get; set; } = false;
        public bool ShowAnswers { get; set; } = false;
    }
}
