using ExamWeb.Application.DTO.Auth;
using ExamWeb.Infrastructure.Data;
using ExamWeb.Server.Options;
using ExamWeb.Infrastructure.Security;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace ExamWeb.Server.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly AppDbContext _dbContext;
        private readonly JwtSettings _jwtSettings;

        public AuthController(AppDbContext dbContext, IOptions<JwtSettings> jwtOptions)
        {
            _dbContext = dbContext;
            _jwtSettings = jwtOptions.Value;
        }

        [AllowAnonymous]
        [HttpPost("login")]
        public async Task<ActionResult<LoginResponse>> Login(LoginRequest request, CancellationToken cancellationToken)
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
            {
                return BadRequest(new { message = "Vui lòng nhập tài khoản và mật khẩu" });
            }

            var username = request.Username.Trim();
            var account = await _dbContext.Accounts
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.Username == username, cancellationToken);

            if (account == null || !PasswordHashing.Verify(request.Password, account.PasswordHash))
            {
                return Unauthorized(new { message = "Tên đăng nhập hoặc mật khẩu không đúng" });
            }

            if (string.IsNullOrWhiteSpace(_jwtSettings.Key))
            {
                return StatusCode(StatusCodes.Status500InternalServerError, new { message = "Chưa cấu hình khóa JWT" });
            }

            var expiredAt = DateTime.UtcNow.AddHours(8);
            var claims = new List<Claim>
            {
                new(JwtRegisteredClaimNames.Sub, account.Id.ToString()),
                new(ClaimTypes.NameIdentifier, account.Id.ToString()),
                new(ClaimTypes.Name, account.DisplayName),
                new("username", account.Username),
                new(ClaimTypes.Role, account.Role),
                new("role", account.Role)
            };

            var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.Key));
            var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.HmacSha256);
            var token = new JwtSecurityToken(
                issuer: _jwtSettings.Issuer,
                audience: _jwtSettings.Audience,
                claims: claims,
                expires: expiredAt,
                signingCredentials: credentials);

            return Ok(new LoginResponse
            {
                AccessToken = new JwtSecurityTokenHandler().WriteToken(token),
                AccountId = account.Id,
                Username = account.Username,
                DisplayName = account.DisplayName,
                Role = account.Role,
                Grade = account.Grade,
                ClassName = account.ClassName,
                ExpiredAt = expiredAt
            });
        }
    }
}
