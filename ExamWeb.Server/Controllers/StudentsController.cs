using ExamWeb.Application.DTO.Students;
using ExamWeb.Application.IService;
using ExamWeb.Domain.DomainExceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExamWeb.Server.Controllers
{
    [ApiController]
    [Route("api/students")]
    [Authorize(Roles = "Admin")]
    public class StudentsController : ControllerBase
    {
        private readonly IStudentService _studentService;

        public StudentsController(IStudentService studentService)
        {
            _studentService = studentService;
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<StudentDto>>> GetStudents(CancellationToken cancellationToken)
        {
            var students = await _studentService.GetStudentsAsync(cancellationToken);
            return Ok(students);
        }

        [HttpPost]
        public async Task<ActionResult<StudentDto>> CreateStudent(CreateStudentRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var student = await _studentService.CreateStudentAsync(request, cancellationToken);
                return CreatedAtAction(nameof(GetStudents), new { id = student.Id }, student);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpPut("{studentId:int}")]
        public async Task<ActionResult<StudentDto>> UpdateStudent(int studentId, UpdateStudentRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var student = await _studentService.UpdateStudentAsync(studentId, request, cancellationToken);
                return student == null ? NotFound() : Ok(student);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpDelete("{studentId:int}")]
        public async Task<IActionResult> DeleteStudent(int studentId, CancellationToken cancellationToken)
        {
            var deleted = await _studentService.DeleteStudentAsync(studentId, cancellationToken);
            return deleted ? NoContent() : NotFound();
        }
    }
}
