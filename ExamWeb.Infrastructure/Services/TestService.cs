using ExamWeb.Application.DTO.Tests;
using ExamWeb.Application.IService;
using ExamWeb.Domain.DomainExceptions;
using ExamWeb.Domain.Entity.Answers;
using ExamWeb.Domain.Entity.ExamAttempts;
using ExamWeb.Domain.Entity.ExamMonitorEvents;
using ExamWeb.Domain.Entity.Questions;
using ExamWeb.Domain.Entity.Tests;
using ExamWeb.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace ExamWeb.Infrastructure.Services
{
    public class TestService : ITestService
    {
        private readonly AppDbContext _dbContext;
        private readonly ICurrentUserService _currentUser;
        private readonly IAiAssistantService _aiAssistantService;

        public TestService(
            AppDbContext dbContext,
            ICurrentUserService currentUser,
            IAiAssistantService aiAssistantService)
        {
            _dbContext = dbContext;
            _currentUser = currentUser;
            _aiAssistantService = aiAssistantService;
        }

        public async Task<IReadOnlyList<TestListDto>> GetTestsAsync(CancellationToken cancellationToken = default)
        {
            var query = _dbContext.Tests.AsNoTracking();

            if (_currentUser.IsStudent && _currentUser.AccountId.HasValue)
            {
                var accountId = _currentUser.AccountId.Value;
                query = query.Where(test =>
                    _dbContext.TestStudentAccesses.Any(access =>
                        access.TestId == test.Id && access.AccountId == accountId));
            }

            var tests = await query
                .OrderByDescending(x => x.CreatedAt)
                .ToListAsync(cancellationToken);

            return tests.Select(MapList).ToList();
        }

        public async Task<IReadOnlyList<ExamAttemptDto>> GetAttemptsAsync(string testId, CancellationToken cancellationToken = default)
        {
            var attempts = await _dbContext.ExamAttempts
                .AsNoTracking()
                .Where(x => x.TestId == testId)
                .OrderByDescending(x => x.SubmittedAt)
                .ToListAsync(cancellationToken);

            var accountIds = attempts
                .Where(x => x.AccountId.HasValue)
                .Select(x => x.AccountId!.Value)
                .Distinct()
                .ToList();

            var accounts = accountIds.Count == 0
                ? new Dictionary<int, Domain.Entity.Accounts.Account>()
                : await _dbContext.Accounts
                    .AsNoTracking()
                    .Where(x => accountIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, cancellationToken);

            return attempts
                .Select(attempt =>
                {
                    accounts.TryGetValue(attempt.AccountId ?? 0, out var account);
                    return MapAttempt(attempt, account);
                })
                .ToList();
        }

        public async Task<IReadOnlyList<ScreenMonitorSessionDto>> GetScreenMonitorSessionsAsync(string testId, CancellationToken cancellationToken = default)
        {
            var events = await _dbContext.ExamMonitorEvents
                .AsNoTracking()
                .Where(x => x.TestId == testId)
                .OrderByDescending(x => x.CreatedAt)
                .Take(300)
                .ToListAsync(cancellationToken);

            var activeCutoff = DateTime.UtcNow.AddMinutes(-2);

            return events
                .GroupBy(x => x.SessionId)
                .Select(group =>
                {
                    var orderedEvents = group.OrderByDescending(x => x.CreatedAt).ToList();
                    var latest = orderedEvents[0];
                    var latestImage = orderedEvents.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x.ImageDataUrl));

                    return new ScreenMonitorSessionDto
                    {
                        TestId = latest.TestId,
                        TestName = latest.TestName,
                        SessionId = latest.SessionId,
                        StudentName = latest.StudentName,
                        LastEventType = latest.EventType,
                        LastMessage = latest.Message,
                        LastImageDataUrl = latestImage?.ImageDataUrl,
                        LastSeenAt = latest.CreatedAt,
                        EventCount = orderedEvents.Count,
                        IsActive = latest.CreatedAt >= activeCutoff && latest.EventType != "ScreenShareStopped",
                        Events = orderedEvents.Take(12).Select(MapScreenMonitorEvent).ToList()
                    };
                })
                .OrderByDescending(x => x.LastSeenAt)
                .ToList();
        }

        public async Task<TestDetailDto?> GetTestAsync(string testId, CancellationToken cancellationToken = default)
        {
            var test = await LoadTestAsync(testId, true, cancellationToken);
            if (test == null)
            {
                return null;
            }

            var assignedStudentIds = await GetAssignedStudentIdsAsync(testId, cancellationToken);
            return MapDetail(test, assignedStudentIds);
        }

        public async Task<TestTakeDto?> GetTestForTakingAsync(string testId, CancellationToken cancellationToken = default)
        {
            if (!await HasStudentAccessAsync(testId, cancellationToken))
            {
                throw new DomainException("Bạn không được phép làm đề thi này");
            }

            var test = await LoadTestAsync(testId, true, cancellationToken);
            return test == null ? null : MapTake(test);
        }

        public async Task<TestPracticeDto?> GetTestForPracticeAsync(string testId, CancellationToken cancellationToken = default)
        {
            if (!await HasStudentAccessAsync(testId, cancellationToken))
            {
                throw new DomainException("Bạn không được phép luyện tập đề thi này");
            }

            var test = await LoadTestAsync(testId, true, cancellationToken);
            if (test == null)
            {
                return null;
            }

            if (!test.AllowPracticeMode)
            {
                throw new DomainException("Đề thi này không cho phép chế độ luyện tập");
            }

            return MapPractice(test);
        }

        public async Task<TestDetailDto> CreateTestAsync(CreateTestRequest request, CancellationToken cancellationToken = default)
        {
            var test = new Test(request.TestName, request.DurationMinutes, request.AllowPracticeMode);
            _dbContext.Tests.Add(test);
            await _dbContext.SaveChangesAsync(cancellationToken);
            await ReplaceAssignedStudentsAsync(test.Id, request.AssignedStudentIds, cancellationToken);
            var assignedStudentIds = await GetAssignedStudentIdsAsync(test.Id, cancellationToken);
            return MapDetail(test, assignedStudentIds);
        }

        public async Task<TestDetailDto?> UpdateTestAsync(string testId, UpdateTestRequest request, CancellationToken cancellationToken = default)
        {
            var test = await LoadTestAsync(testId, true, cancellationToken);
            if (test == null)
            {
                return null;
            }

            test.ChangeTestName(request.TestName);
            test.ChangeDurationMinutes(request.DurationMinutes);
            test.ChangeAllowPracticeMode(request.AllowPracticeMode);
            test.UpdateTestSummary();
            await ReplaceAssignedStudentsAsync(testId, request.AssignedStudentIds, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);
            var assignedStudentIds = await GetAssignedStudentIdsAsync(testId, cancellationToken);
            return MapDetail(test, assignedStudentIds);
        }

        public async Task<bool> DeleteTestAsync(string testId, CancellationToken cancellationToken = default)
        {
            var test = await LoadTestAsync(testId, true, cancellationToken);
            if (test == null)
            {
                return false;
            }

            var accessRows = await _dbContext.TestStudentAccesses
                .Where(x => x.TestId == testId)
                .ToListAsync(cancellationToken);
            _dbContext.TestStudentAccesses.RemoveRange(accessRows);
            _dbContext.Tests.Remove(test);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }

        public async Task<QuestionDto?> AddQuestionAsync(string testId, SaveQuestionRequest request, CancellationToken cancellationToken = default)
        {
            ValidateQuestionRequest(request);

            var test = await LoadTestAsync(testId, true, cancellationToken);
            if (test == null)
            {
                return null;
            }

            var questionOrderIndex = test.Questions.Count == 0
                ? 0
                : test.Questions.Max(x => x.OrderIndex) + 1;
            var question = test.AddQuestion(request.Content, request.Score, questionOrderIndex);
            AddAnswers(question, request.Answers ?? new List<SaveAnswerRequest>());
            await _dbContext.SaveChangesAsync(cancellationToken);
            return MapQuestion(question);
        }

        public async Task<QuestionDto?> UpdateQuestionAsync(string testId, string questionId, SaveQuestionRequest request, CancellationToken cancellationToken = default)
        {
            ValidateQuestionRequest(request);

            var test = await LoadTestAsync(testId, true, cancellationToken);
            var question = test?.Questions.FirstOrDefault(x => x.Id == questionId);
            if (test == null || question == null)
            {
                return null;
            }

            question.ChangeContent(request.Content);
            question.ChangeScore(request.Score);
            var existingAnswers = question.Answers.ToList();
            _dbContext.Answers.RemoveRange(existingAnswers);
            question.ClearAnswers();
            AddAnswers(question, request.Answers ?? new List<SaveAnswerRequest>());
            test.UpdateTestSummary();
            await _dbContext.SaveChangesAsync(cancellationToken);
            return MapQuestion(question);
        }

        public async Task<bool> DeleteQuestionAsync(string testId, string questionId, CancellationToken cancellationToken = default)
        {
            var test = await LoadTestAsync(testId, true, cancellationToken);
            var question = test?.Questions.FirstOrDefault(x => x.Id == questionId);
            if (test == null || question == null)
            {
                return false;
            }

            test.DeleteQuestion(questionId);
            _dbContext.Questions.Remove(question);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return true;
        }

        public async Task<SubmitTestResponse?> SubmitTestAsync(string testId, SubmitTestRequest request, CancellationToken cancellationToken = default)
        {
            if (!_currentUser.IsStudent || !_currentUser.AccountId.HasValue)
            {
                throw new DomainException("Chỉ học sinh mới được nộp bài");
            }

            if (!await HasStudentAccessAsync(testId, cancellationToken))
            {
                throw new DomainException("Bạn không được phép nộp đề thi này");
            }

            var account = await _dbContext.Accounts
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == _currentUser.AccountId.Value, cancellationToken);

            if (account == null)
            {
                throw new DomainException("Tài khoản không hợp lệ");
            }

            var test = await LoadTestAsync(testId, true, cancellationToken);
            if (test == null)
            {
                return null;
            }

            var submittedAnswers = request.Answers ?? new List<SubmitAnswerRequest>();
            var selectedAnswerByQuestion = submittedAnswers
                .GroupBy(x => x.QuestionId)
                .ToDictionary(x => x.Key, x => x.Last().AnswerId);

            var studentName = account.DisplayName;

            var response = new SubmitTestResponse
            {
                TestId = test.Id,
                MonitoringSessionId = request.MonitoringSessionId,
                StudentName = studentName,
                ScoreTotal = test.ScoreTotal,
                QuestionCount = test.QuestionCount,
                DurationSeconds = request.DurationSeconds,
                IsTimeExpired = request.IsTimeExpired
            };

            foreach (var question in test.Questions.OrderBy(x => x.OrderIndex))
            {
                selectedAnswerByQuestion.TryGetValue(question.Id, out var selectedAnswerId);
                var selectedAnswer = question.Answers.FirstOrDefault(x => x.Id == selectedAnswerId);
                var correctAnswer = question.Answers.FirstOrDefault(x => x.IsCorrect);
                var isCorrect = selectedAnswer?.IsCorrect == true;
                var earned = isCorrect ? question.Score : 0;

                response.Score += earned;
                if (isCorrect)
                {
                    response.CorrectCount++;
                }

                response.Results.Add(new SubmitQuestionResultDto
                {
                    QuestionId = question.Id,
                    QuestionContent = question.Content,
                    SelectedAnswerId = selectedAnswer?.Id,
                    CorrectAnswerId = correctAnswer?.Id,
                    IsCorrect = isCorrect,
                    ScoreEarned = earned
                });
            }

            var attempt = new ExamAttempt(
                test.Id,
                test.TestName,
                account.Id,
                studentName,
                response.Score,
                response.ScoreTotal,
                response.CorrectCount,
                response.QuestionCount,
                request.MonitoringSessionId,
                request.DurationSeconds,
                request.IsTimeExpired);

            _dbContext.ExamAttempts.Add(attempt);
            await _dbContext.SaveChangesAsync(cancellationToken);
            response.SubmittedAt = attempt.SubmittedAt;

            return response;
        }

        public async Task<string> ExplainQuestionAsync(
            string testId,
            string questionId,
            string selectedAnswerId,
            CancellationToken cancellationToken = default)
        {
            if (!_currentUser.IsStudent || !_currentUser.AccountId.HasValue)
            {
                throw new DomainException("Chỉ học sinh mới được sử dụng trợ giảng AI");
            }

            if (!await HasStudentAccessAsync(testId, cancellationToken))
            {
                throw new DomainException("Bạn không được phép luyện tập đề thi này");
            }

            if (string.IsNullOrWhiteSpace(selectedAnswerId))
            {
                throw new DomainException("Cần chọn đáp án trước khi yêu cầu giải thích");
            }

            var test = await LoadTestAsync(testId, false, cancellationToken);
            if (test == null)
            {
                throw new DomainException("Không tìm thấy đề thi");
            }

            if (!test.AllowPracticeMode)
            {
                throw new DomainException("Đề thi này không cho phép chế độ luyện tập");
            }

            var question = test.Questions.FirstOrDefault(x => x.Id == questionId);
            if (question == null)
            {
                throw new DomainException("Không tìm thấy câu hỏi");
            }

            var selectedAnswer = question.Answers.FirstOrDefault(x => x.Id == selectedAnswerId);
            if (selectedAnswer == null)
            {
                throw new DomainException("Đáp án học sinh chọn không hợp lệ");
            }

            if (selectedAnswer.IsCorrect)
            {
                throw new DomainException("Chỉ giải thích khi học sinh chọn sai đáp án");
            }

            var correctAnswer = question.Answers.FirstOrDefault(x => x.IsCorrect);
            if (correctAnswer == null)
            {
                throw new DomainException("Câu hỏi chưa có đáp án đúng");
            }

            return await _aiAssistantService.GetExplanationAsync(
                question.Content,
                selectedAnswer.Content,
                correctAnswer.Content,
                cancellationToken);
        }

        public async Task<ScreenMonitorEventDto?> RecordScreenMonitorEventAsync(string testId, ScreenMonitorEventRequest request, CancellationToken cancellationToken = default)
        {
            if (!_currentUser.IsStudent || !_currentUser.AccountId.HasValue)
            {
                throw new DomainException("Chỉ học sinh mới được ghi nhận theo dõi");
            }

            if (!await HasStudentAccessAsync(testId, cancellationToken))
            {
                throw new DomainException("Bạn không được phép theo dõi đề thi này");
            }

            var account = await _dbContext.Accounts
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == _currentUser.AccountId.Value, cancellationToken);

            if (account == null)
            {
                throw new DomainException("Tài khoản không hợp lệ");
            }

            var test = await _dbContext.Tests
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Id == testId, cancellationToken);

            if (test == null)
            {
                return null;
            }

            ValidateScreenMonitorEventRequest(request);

            var monitorEvent = new ExamMonitorEvent(
                test.Id,
                test.TestName,
                request.SessionId,
                account.DisplayName,
                request.EventType,
                request.Message,
                request.ImageDataUrl);

            _dbContext.ExamMonitorEvents.Add(monitorEvent);
            await _dbContext.SaveChangesAsync(cancellationToken);
            return MapScreenMonitorEvent(monitorEvent);
        }

        private async Task<bool> HasStudentAccessAsync(string testId, CancellationToken cancellationToken)
        {
            if (_currentUser.IsAdmin)
            {
                return true;
            }

            if (!_currentUser.IsStudent || !_currentUser.AccountId.HasValue)
            {
                return false;
            }

            return await _dbContext.TestStudentAccesses
                .AsNoTracking()
                .AnyAsync(
                    x => x.TestId == testId && x.AccountId == _currentUser.AccountId.Value,
                    cancellationToken);
        }

        private async Task<List<int>> GetAssignedStudentIdsAsync(string testId, CancellationToken cancellationToken)
        {
            return await _dbContext.TestStudentAccesses
                .AsNoTracking()
                .Where(x => x.TestId == testId)
                .Select(x => x.AccountId)
                .OrderBy(x => x)
                .ToListAsync(cancellationToken);
        }

        private async Task ReplaceAssignedStudentsAsync(string testId, IEnumerable<int> studentIds, CancellationToken cancellationToken)
        {
            var normalizedIds = studentIds
                .Where(x => x > 0)
                .Distinct()
                .ToList();

            if (normalizedIds.Count > 0)
            {
                var validCount = await _dbContext.Accounts
                    .CountAsync(x => normalizedIds.Contains(x.Id) && x.Role == "User", cancellationToken);

                if (validCount != normalizedIds.Count)
                {
                    throw new DomainException("Danh sách học sinh không hợp lệ");
                }
            }

            var existing = await _dbContext.TestStudentAccesses
                .Where(x => x.TestId == testId)
                .ToListAsync(cancellationToken);

            _dbContext.TestStudentAccesses.RemoveRange(existing);

            foreach (var studentId in normalizedIds)
            {
                _dbContext.TestStudentAccesses.Add(new TestStudentAccess(testId, studentId));
            }

            await _dbContext.SaveChangesAsync(cancellationToken);
        }

        private async Task<Test?> LoadTestAsync(string testId, bool track, CancellationToken cancellationToken)
        {
            var query = _dbContext.Tests
                .Include(x => x.Questions)
                .ThenInclude(x => x.Answers)
                .AsQueryable();

            if (!track)
            {
                query = query.AsNoTracking();
            }

            return await query.FirstOrDefaultAsync(x => x.Id == testId, cancellationToken);
        }

        private static void ValidateQuestionRequest(SaveQuestionRequest request)
        {
            var answers = request.Answers ?? new List<SaveAnswerRequest>();

            if (request.Score <= 0)
            {
                throw new DomainException("Điểm câu hỏi phải lớn hơn 0");
            }

            if (answers.Count < 2)
            {
                throw new DomainException("Mỗi câu hỏi cần ít nhất 2 đáp án");
            }

            if (answers.Any(x => string.IsNullOrWhiteSpace(x.Content)))
            {
                throw new DomainException("Nội dung đáp án không được bỏ trống");
            }

            if (answers.Count(x => x.IsCorrect) != 1)
            {
                throw new DomainException("Mỗi câu hỏi cần đúng 1 đáp án đúng");
            }
        }

        private static void AddAnswers(Question question, IEnumerable<SaveAnswerRequest> answers)
        {
            var answerList = answers.ToList();
            for (var index = 0; index < answerList.Count; index++)
            {
                var answer = answerList[index];
                question.AddAnswer(answer.Content, answer.IsCorrect, index);
            }
        }

        private static void ValidateScreenMonitorEventRequest(ScreenMonitorEventRequest request)
        {
            if (string.IsNullOrWhiteSpace(request.SessionId))
            {
                throw new DomainException("Phiên theo dõi không được bỏ trống");
            }

            if (string.IsNullOrWhiteSpace(request.EventType))
            {
                throw new DomainException("Loại sự kiện theo dõi không được bỏ trống");
            }

            if (request.ImageDataUrl?.Length > 500_000)
            {
                throw new DomainException("Ảnh theo dõi quá lớn");
            }
        }

        private static TestListDto MapList(Test test)
        {
            return new TestListDto
            {
                Id = test.Id,
                TestName = test.TestName,
                DurationMinutes = test.DurationMinutes,
                AllowPracticeMode = test.AllowPracticeMode,
                QuestionCount = test.QuestionCount,
                ScoreTotal = test.ScoreTotal,
                CreatedAt = test.CreatedAt
            };
        }

        private static TestDetailDto MapDetail(Test test, IReadOnlyList<int> assignedStudentIds)
        {
            return new TestDetailDto
            {
                Id = test.Id,
                TestName = test.TestName,
                DurationMinutes = test.DurationMinutes,
                AllowPracticeMode = test.AllowPracticeMode,
                QuestionCount = test.QuestionCount,
                ScoreTotal = test.ScoreTotal,
                CreatedAt = test.CreatedAt,
                AssignedStudentIds = assignedStudentIds.ToList(),
                Questions = test.Questions
                    .OrderBy(x => x.OrderIndex)
                    .Select(MapQuestion)
                    .ToList()
            };
        }

        private static QuestionDto MapQuestion(Question question)
        {
            return new QuestionDto
            {
                Id = question.Id,
                Content = question.Content,
                Score = question.Score,
                Answers = question.Answers
                    .OrderBy(x => x.OrderIndex)
                    .Select(MapAnswer)
                    .ToList()
            };
        }

        private static AnswerDto MapAnswer(Answer answer)
        {
            return new AnswerDto
            {
                Id = answer.Id,
                Content = answer.Content,
                IsCorrect = answer.IsCorrect
            };
        }

        private static TestTakeDto MapTake(Test test)
        {
            return new TestTakeDto
            {
                Id = test.Id,
                TestName = test.TestName,
                DurationMinutes = test.DurationMinutes,
                AllowPracticeMode = test.AllowPracticeMode,
                QuestionCount = test.QuestionCount,
                ScoreTotal = test.ScoreTotal,
                Questions = test.Questions
                    .OrderBy(x => x.OrderIndex)
                    .Select(x => new QuestionTakeDto
                    {
                        Id = x.Id,
                        Content = x.Content,
                        Score = x.Score,
                        Answers = x.Answers
                            .OrderBy(a => a.OrderIndex)
                            .Select(a => new AnswerOptionDto
                            {
                                Id = a.Id,
                                Content = a.Content
                            })
                            .ToList()
                    })
                    .ToList()
            };
        }

        private static TestPracticeDto MapPractice(Test test)
        {
            return new TestPracticeDto
            {
                Id = test.Id,
                TestName = test.TestName,
                DurationMinutes = test.DurationMinutes,
                AllowPracticeMode = test.AllowPracticeMode,
                QuestionCount = test.QuestionCount,
                ScoreTotal = test.ScoreTotal,
                Questions = test.Questions
                    .OrderBy(x => x.OrderIndex)
                    .Select(x => new QuestionPracticeDto
                    {
                        Id = x.Id,
                        Content = x.Content,
                        Score = x.Score,
                        Answers = x.Answers
                            .OrderBy(a => a.OrderIndex)
                            .Select(a => new PracticeAnswerOptionDto
                            {
                                Id = a.Id,
                                Content = a.Content,
                                IsCorrect = a.IsCorrect
                            })
                            .ToList()
                    })
                    .ToList()
            };
        }

        private static ExamAttemptDto MapAttempt(ExamAttempt attempt, Domain.Entity.Accounts.Account? account)
        {
            return new ExamAttemptDto
            {
                Id = attempt.Id,
                TestId = attempt.TestId,
                AccountId = attempt.AccountId,
                MonitoringSessionId = attempt.MonitoringSessionId,
                TestName = attempt.TestName,
                StudentName = attempt.StudentName,
                Grade = account?.Grade,
                ClassName = account?.ClassName,
                Score = attempt.Score,
                ScoreTotal = attempt.ScoreTotal,
                CorrectCount = attempt.CorrectCount,
                QuestionCount = attempt.QuestionCount,
                DurationSeconds = attempt.DurationSeconds,
                IsTimeExpired = attempt.IsTimeExpired,
                SubmittedAt = attempt.SubmittedAt
            };
        }

        private static ScreenMonitorEventDto MapScreenMonitorEvent(ExamMonitorEvent monitorEvent)
        {
            return new ScreenMonitorEventDto
            {
                Id = monitorEvent.Id,
                TestId = monitorEvent.TestId,
                TestName = monitorEvent.TestName,
                SessionId = monitorEvent.SessionId,
                StudentName = monitorEvent.StudentName,
                EventType = monitorEvent.EventType,
                Message = monitorEvent.Message,
                ImageDataUrl = monitorEvent.ImageDataUrl,
                CreatedAt = monitorEvent.CreatedAt
            };
        }
    }
}
