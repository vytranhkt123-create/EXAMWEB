using ExamWeb.Application.DTO.Arenas;

namespace ExamWeb.Application.IService
{
    public interface IArenaService
    {
        Task<IReadOnlyList<ArenaListDto>> GetArenasAsync(CancellationToken cancellationToken = default);
        Task<ArenaDetailDto?> GetArenaAsync(string arenaId, CancellationToken cancellationToken = default);
        Task<CreateArenaResponse> CreateArenaAsync(CreateArenaRequest request, CancellationToken cancellationToken = default);
        Task<ArenaDetailDto?> UpdateArenaAsync(string arenaId, UpdateArenaRequest request, CancellationToken cancellationToken = default);
        Task<bool> DeleteArenaAsync(string arenaId, CancellationToken cancellationToken = default);
        Task<bool> ActivateArenaAsync(string arenaId, CancellationToken cancellationToken = default);
        Task<bool> DeactivateArenaAsync(string arenaId, CancellationToken cancellationToken = default);
    }
}
