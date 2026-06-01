using ExamWeb.Application.IService;
using ExamWeb.Infrastructure.Data;
using ExamWeb.Infrastructure.Services;
using ExamWeb.Server.Services;
using ExamWeb.Server.Options;
using ExamWeb.Domain.Entity.Accounts;
using ExamWeb.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using System.Text.Json.Serialization;

namespace ExamWeb.Server
{
    public class Program
    {
        public static void Main(string[] args)
        {
            var builder = WebApplication.CreateBuilder(args);
            var workspaceServerSettingsPath = Path.Combine(builder.Environment.ContentRootPath, "ExamWeb.Server");
            if (Directory.Exists(workspaceServerSettingsPath))
            {
                builder.Configuration
                    .AddJsonFile(Path.Combine(workspaceServerSettingsPath, "appsettings.json"), optional: true, reloadOnChange: true)
                    .AddJsonFile(Path.Combine(workspaceServerSettingsPath, $"appsettings.{builder.Environment.EnvironmentName}.json"), optional: true, reloadOnChange: true)
                    .AddEnvironmentVariables();

                if (args.Length > 0)
                {
                    builder.Configuration.AddCommandLine(args);
                }
            }

            builder.Logging.ClearProviders();
            builder.Logging.AddConsole();
            builder.Logging.AddDebug();
            builder.Services.AddDataProtection()
                .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, "DataProtectionKeys")));

            builder.Services.AddControllers()
                .AddJsonOptions(opt =>
                {
                    opt.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
                });
            builder.Services.AddCors(options =>
            {
                options.AddPolicy("AllowAll", policy =>
                {
                    policy.SetIsOriginAllowed(_ => true) // Cho phép mọi Frontend Port kết nối
                          .AllowAnyMethod()              // Cho phép mọi phương thức (GET, POST, OPTIONS...)
                          .AllowAnyHeader()              // Cho phép mọi Header
                          .AllowCredentials();           // Cho phép đính kèm token bảo mật
                });
            });
            builder.Services.AddOpenApi();
            builder.Services.AddDbContext<AppDbContext>(options =>
            {
                var connectionString = builder.Configuration.GetConnectionString("DefaultConnectionString");
                options.UseSqlServer(connectionString, sqlOptions => sqlOptions.EnableRetryOnFailure());
            });
            builder.Services.AddHttpContextAccessor();
            builder.Services.AddScoped<ICurrentUserService, CurrentUserService>();
            builder.Services.AddScoped<ITestService, TestService>();
            builder.Services.AddScoped<IStudentService, StudentService>();
            builder.Services.AddScoped<IOnlineClassService, OnlineClassService>();
            builder.Services.AddScoped<IScheduleService, ScheduleService>();
            builder.Services.AddSingleton<OnlineClassSocketManager>();
            builder.Services.AddSingleton<IOnlineClassRealtimeNotifier>(sp => sp.GetRequiredService<OnlineClassSocketManager>());
            builder.Services.AddAuthorization();
            builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("JwtSettings"));

            var jwtSettings = builder.Configuration.GetSection("JwtSettings");
            var secretKey = jwtSettings["Key"] ?? string.Empty;
            builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
                .AddJwtBearer(JwtBearerDefaults.AuthenticationScheme, option =>
                {
                    option.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidateAudience = true,
                        ValidateLifetime = true,
                        ValidateIssuerSigningKey = true,
                        ValidIssuer = jwtSettings["Issuer"],
                        ValidAudience = jwtSettings["Audience"],
                        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey)),
                        RoleClaimType = System.Security.Claims.ClaimTypes.Role,
                        NameClaimType = System.Security.Claims.ClaimTypes.Name
                    };
                    option.Events = new JwtBearerEvents
                    {
                        OnMessageReceived = context =>
                        {
                            var accessToken = context.Request.Query["access_token"];
                            var path = context.HttpContext.Request.Path;
                            if (!string.IsNullOrWhiteSpace(accessToken) &&
                                path.StartsWithSegments("/ws/online-class"))
                            {
                                context.Token = accessToken;
                            }

                            return Task.CompletedTask;
                        },
                        OnAuthenticationFailed = context =>
                        {
                            if (context.Exception.GetType() == typeof(SecurityTokenExpiredException))
                            {
                                context.Response.Headers["Token-Expired"] = "true";
                            }
                            return Task.CompletedTask;
                        }
                    };
                });

            var app = builder.Build();

            using (var scope = app.Services.CreateScope())
            {
                var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
                dbContext.Database.Migrate();
                SeedDefaultAccounts(dbContext);
            }

            var clientDistCandidates = new[]
            {
                Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "..", "examweb.client", "dist")),
                Path.GetFullPath(Path.Combine(app.Environment.ContentRootPath, "examweb.client", "dist"))
            };
            var clientDistPath = clientDistCandidates.FirstOrDefault(Directory.Exists) ?? clientDistCandidates[0];
            var hasClientDist = Directory.Exists(clientDistPath);

            if (hasClientDist)
            {
                var clientDistProvider = new PhysicalFileProvider(clientDistPath);
                app.UseDefaultFiles(new DefaultFilesOptions
                {
                    FileProvider = clientDistProvider
                });
                app.UseStaticFiles(new StaticFileOptions
                {
                    FileProvider = clientDistProvider
                });
            }
            else
            {
                app.UseDefaultFiles();
                app.MapStaticAssets();
            }

            if (app.Environment.IsDevelopment())
            {
                app.MapOpenApi();
            }
            else
            {
                app.UseHttpsRedirection();
            }

            app.UseWebSockets();
            app.UseCors("AllowAll");
            app.UseAuthentication();
            app.UseAuthorization();
            

            app.Map("/ws/online-class", async context =>
            {
                var socketManager = context.RequestServices.GetRequiredService<OnlineClassSocketManager>();
                await socketManager.HandleConnectionAsync(context);
            });
            app.MapControllers();

            if (hasClientDist)
            {
                app.MapFallback(async context =>
                {
                    if (context.Request.Path.StartsWithSegments("/api"))
                    {
                        context.Response.StatusCode = StatusCodes.Status404NotFound;
                        await context.Response.WriteAsJsonAsync(new { message = "API endpoint không tồn tại" });
                        return;
                    }

                    context.Response.ContentType = "text/html; charset=utf-8";
                    await context.Response.SendFileAsync(Path.Combine(clientDistPath, "index.html"));
                });
            }
            else
            {
                app.MapFallbackToFile("/index.html");
            }

            app.Run();
        }

        private static void SeedDefaultAccounts(AppDbContext dbContext)
        {
            SeedAccount(dbContext, "admin", "admin123", "Admin", "Thầy giáo");
            SeedAccount(dbContext, "user", "user123", "User", "Học sinh");
            dbContext.SaveChanges();
        }

        private static void SeedAccount(
            AppDbContext dbContext,
            string username,
            string password,
            string role,
            string displayName)
        {
            if (dbContext.Accounts.Any(x => x.Username == username))
            {
                return;
            }

            var account = new Account(username, displayName, role);
            account.ChangePasswordHash(PasswordHashing.Hash(password));
            if (role == "User")
            {
                account.ChangeStudentInfo("10", "A1");
            }
            dbContext.Accounts.Add(account);
        }
    }
}
