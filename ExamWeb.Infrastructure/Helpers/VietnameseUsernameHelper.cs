using System.Globalization;
using System.Text;

namespace ExamWeb.Infrastructure.Helpers
{
    public static class VietnameseUsernameHelper
    {
        public const string DomainSuffix = "@lophocthaydat.com.vn";

        public static string CreateLocalPartFromFullName(string fullName)
        {
            var normalizedName = RemoveVietnameseDiacritics(fullName);
            var parts = normalizedName
                .Split(' ', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(KeepLettersAndDigits)
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .ToArray();

            if (parts.Length == 0)
            {
                return "HocSinh";
            }

            var lastName = ToTitleToken(parts[^1]);
            var initials = string.Concat(parts.Take(parts.Length - 1).Select(GetInitial));
            return string.IsNullOrWhiteSpace($"{lastName}{initials}") ? "HocSinh" : $"{lastName}{initials}";
        }

        public static string RemoveVietnameseDiacritics(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;

            var normalized = value
                .Replace('đ', 'd')
                .Replace('Đ', 'D')
                .Normalize(NormalizationForm.FormD);

            var builder = new StringBuilder(normalized.Length);
            foreach (var character in normalized)
            {
                if (CharUnicodeInfo.GetUnicodeCategory(character) != UnicodeCategory.NonSpacingMark)
                {
                    builder.Append(character);
                }
            }

            return builder.ToString().Normalize(NormalizationForm.FormC);
        }

        public static string BuildUsername(string localPart, int? numberSuffix = null)
        {
            var suffix = numberSuffix.HasValue ? numberSuffix.Value.ToString(CultureInfo.InvariantCulture) : string.Empty;
            return $"{localPart}{suffix}{DomainSuffix}";
        }

        private static string KeepLettersAndDigits(string value)
        {
            var builder = new StringBuilder(value.Length);
            foreach (var character in value)
            {
                if (char.IsLetterOrDigit(character))
                {
                    builder.Append(character);
                }
            }

            return builder.ToString();
        }

        private static string ToTitleToken(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return string.Empty;

            var lower = value.ToLowerInvariant();
            return $"{char.ToUpperInvariant(lower[0])}{lower[1..]}";
        }

        private static string GetInitial(string value)
        {
            return string.IsNullOrWhiteSpace(value)
                ? string.Empty
                : char.ToUpperInvariant(value[0]).ToString(CultureInfo.InvariantCulture);
        }
    }
}
