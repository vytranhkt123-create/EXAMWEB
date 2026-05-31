using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using ExamWeb.Application.IService;

namespace ExamWeb.Server.Services
{
    public class CurrentUserService : ICurrentUserService
    {
        private readonly IHttpContextAccessor _httpContextAccessor;

        public CurrentUserService(IHttpContextAccessor httpContextAccessor)
        {
            _httpContextAccessor = httpContextAccessor;
        }

        public bool IsAuthenticated => AccountId.HasValue;

        public bool IsAdmin => Role == "Admin";

        public bool IsStudent => Role == "User";

        public int? AccountId
        {
            get
            {
                var user = _httpContextAccessor.HttpContext?.User;
                if (user?.Identity?.IsAuthenticated != true)
                {
                    return null;
                }

                var idValue = user.FindFirstValue(ClaimTypes.NameIdentifier)
                    ?? user.FindFirstValue(JwtRegisteredClaimNames.Sub);

                return int.TryParse(idValue, out var accountId) ? accountId : null;
            }
        }

        public string? Username =>
            _httpContextAccessor.HttpContext?.User?.FindFirstValue("username");

        public string? Role =>
            _httpContextAccessor.HttpContext?.User?.FindFirstValue(ClaimTypes.Role)
            ?? _httpContextAccessor.HttpContext?.User?.FindFirstValue("role");
    }
}
