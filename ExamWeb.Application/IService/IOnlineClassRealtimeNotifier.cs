namespace ExamWeb.Application.IService
{
    public interface IOnlineClassRealtimeNotifier
    {
        Task BroadcastAsync(string eventType, object? payload, CancellationToken cancellationToken = default);
    }
}
