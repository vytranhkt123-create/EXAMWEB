namespace ExamWeb.Domain.DomainExceptions
{
    public class ForbiddenDomainException : DomainException
    {
        public ForbiddenDomainException(string message) : base(message) { }
    }
}
