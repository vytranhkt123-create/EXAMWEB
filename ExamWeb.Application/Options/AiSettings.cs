namespace ExamWeb.Application.Options
{
    public class AiSettings
    {
        public string Provider { get; set; } = "Gemini";
        public string ApiKey { get; set; } = string.Empty;
        public string Model { get; set; } = "gemini-3-flash-preview";
        public string BaseUrl { get; set; } = "https://generativelanguage.googleapis.com/v1beta";
    }
}
