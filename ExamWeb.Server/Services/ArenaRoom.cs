using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text.Json;
using ExamWeb.Domain.Entity.Questions;

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
    }

    public class ArenaRoom
    {
        public string RoomId { get; set; } = string.Empty; // 6-digit PIN
        public string TestId { get; set; } = string.Empty;
        public string TestName { get; set; } = string.Empty;
        public List<ArenaQuestionDto> Questions { get; set; } = new();
        public int CurrentQuestionIndex { get; set; } = -1; // -1 = Lobby, 0+ = question active
        public ConcurrentDictionary<string, ArenaPlayer> Players { get; } = new();
        public string HostConnectionId { get; set; } = string.Empty;
        public DateTime? QuestionStartTime { get; set; }
        public bool IsClosed { get; set; } = false;
        public bool ShowAnswers { get; set; } = false;
    }
}
