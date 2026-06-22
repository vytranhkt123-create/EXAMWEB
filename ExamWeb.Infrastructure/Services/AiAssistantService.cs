using System.Text;
using System.Text.Json;
using ExamWeb.Application.IService;
using ExamWeb.Application.Options;
using ExamWeb.Domain.DomainExceptions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace ExamWeb.Infrastructure.Services
{
    public class AiAssistantService : IAiAssistantService
    {
        private readonly HttpClient _httpClient;
        private readonly AiSettings _settings;
        private readonly ILogger<AiAssistantService> _logger;

        public AiAssistantService(
            HttpClient httpClient,
            IOptions<AiSettings> settings,
            ILogger<AiAssistantService> logger)
        {
            _httpClient = httpClient;
            _settings = settings.Value;
            _logger = logger;
        }

        public async Task<string> GetExplanationAsync(
            string questionContent,
            string studentAnswer,
            string correctAnswer,
            CancellationToken cancellationToken = default)
        {
            if (string.IsNullOrWhiteSpace(_settings.ApiKey))
            {
                throw new DomainException("Chưa cấu hình API key cho trợ giảng AI. Vui lòng liên hệ giáo viên.");
            }

            var prompt = BuildPrompt(questionContent, studentAnswer, correctAnswer);
            var model = string.IsNullOrWhiteSpace(_settings.Model) ? "gemini-3-flash-preview" : _settings.Model.Trim();
            var baseUrl = (_settings.BaseUrl?.TrimEnd('/') ?? "https://generativelanguage.googleapis.com/v1beta").TrimEnd('/');
            var requestUri = $"{baseUrl}/models/{model}:generateContent?key={Uri.EscapeDataString(_settings.ApiKey)}";

            var payload = new
            {
                contents = new[]
                {
                    new
                    {
                        parts = new[]
                        {
                            new { text = prompt }
                        }
                    }
                }
            };

            try
            {
                _logger.LogInformation(
                    "Calling Gemini generateContent for model {Model}",
                    model);

                using var request = new HttpRequestMessage(HttpMethod.Post, requestUri);
                request.Content = new StringContent(
                    JsonSerializer.Serialize(payload),
                    Encoding.UTF8,
                    "application/json");

                using var response = await _httpClient.SendAsync(request, cancellationToken);
                var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning(
                        "Gemini API HTTP error {StatusCode}. Response: {Body}",
                        response.StatusCode,
                        responseBody);
                    throw new DomainException("Dịch vụ AI tạm thời không phản hồi. Vui lòng thử lại sau.");
                }

                return ExtractGeminiText(responseBody);
            }
            catch (DomainException)
            {
                throw;
            }
            catch (JsonException ex)
            {
                _logger.LogError(ex, "Failed to parse Gemini API JSON response");
                throw new DomainException("Không thể đọc phản hồi từ AI. Vui lòng thử lại sau.");
            }
            catch (HttpRequestException ex)
            {
                _logger.LogError(ex, "Network error while calling Gemini API");
                throw new DomainException("Không thể kết nối tới dịch vụ AI. Vui lòng thử lại sau.");
            }
            catch (TaskCanceledException ex) when (!cancellationToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "Gemini API request timed out");
                throw new DomainException("Dịch vụ AI phản hồi quá lâu. Vui lòng thử lại sau.");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Unexpected error while calling Gemini API");
                throw new DomainException("Không thể lấy giải thích từ AI. Vui lòng thử lại sau.");
            }
        }

        private static string BuildPrompt(string questionContent, string studentAnswer, string correctAnswer)
        {
            return
                $"Bạn là giáo viên. Học sinh làm sai câu hỏi: '{questionContent}'. " +
                $"Học sinh chọn: '{studentAnswer}'. Đáp án đúng là: '{correctAnswer}'. " +
                "Hãy giải thích ngắn gọn, dễ hiểu tại sao đáp án đúng lại đúng và đáp án học sinh chọn lại sai.";
        }

        private string ExtractGeminiText(string responseBody)
        {
            using var document = JsonDocument.Parse(responseBody);
            var root = document.RootElement;

            if (root.TryGetProperty("error", out var errorElement))
            {
                var errorMessage = errorElement.TryGetProperty("message", out var messageElement)
                    ? messageElement.GetString()
                    : null;

                _logger.LogWarning(
                    "Gemini API returned error payload: {Message}. Full body: {Body}",
                    errorMessage ?? "Unknown error",
                    responseBody);

                throw new DomainException("Dịch vụ AI tạm thời không phản hồi. Vui lòng thử lại sau.");
            }

            if (!root.TryGetProperty("candidates", out var candidatesElement) ||
                candidatesElement.ValueKind != JsonValueKind.Array ||
                candidatesElement.GetArrayLength() == 0)
            {
                _logger.LogWarning("Gemini API returned no candidates. Response: {Body}", responseBody);
                throw new DomainException("AI không trả về nội dung giải thích.");
            }

            var candidate = candidatesElement[0];
            if (!candidate.TryGetProperty("content", out var contentElement) ||
                !contentElement.TryGetProperty("parts", out var partsElement) ||
                partsElement.ValueKind != JsonValueKind.Array ||
                partsElement.GetArrayLength() == 0)
            {
                _logger.LogWarning("Gemini candidate missing content.parts. Response: {Body}", responseBody);
                throw new DomainException("AI không trả về nội dung giải thích.");
            }

            var part = partsElement[0];
            if (!part.TryGetProperty("text", out var textElement))
            {
                _logger.LogWarning("Gemini part missing text field. Response: {Body}", responseBody);
                throw new DomainException("AI không trả về nội dung giải thích.");
            }

            var text = textElement.GetString();
            if (string.IsNullOrWhiteSpace(text))
            {
                _logger.LogWarning("Gemini returned empty text. Response: {Body}", responseBody);
                throw new DomainException("AI không trả về nội dung giải thích.");
            }

            return text.Trim();
        }
    }
}
