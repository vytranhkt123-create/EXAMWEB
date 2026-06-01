using ExamWeb.Application.DTO.Schedules;
using ExamWeb.Application.IService;
using ExamWeb.Domain.DomainExceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExamWeb.Server.Controllers
{
    [ApiController]
    [Route("api/schedules")]
    [Authorize(Roles = "Admin,User")]
    public class SchedulesController : ControllerBase
    {
        private readonly IScheduleService _scheduleService;

        public SchedulesController(IScheduleService scheduleService)
        {
            _scheduleService = scheduleService;
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<ClassScheduleDto>>> GetSchedules(CancellationToken cancellationToken)
        {
            var schedules = await _scheduleService.GetSchedulesAsync(cancellationToken);
            return Ok(schedules);
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("attendance-requests")]
        public async Task<ActionResult<IReadOnlyList<ScheduleAttendanceDto>>> GetAttendanceRequests(
            [FromQuery] string? scheduleId,
            [FromQuery] string? status,
            CancellationToken cancellationToken)
        {
            try
            {
                var attendances = await _scheduleService.GetAttendanceRequestsAsync(scheduleId, status, cancellationToken);
                return Ok(attendances);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [HttpGet("{scheduleId}")]
        public async Task<ActionResult<ClassScheduleDetailDto>> GetSchedule(string scheduleId, CancellationToken cancellationToken)
        {
            var schedule = await _scheduleService.GetScheduleAsync(scheduleId, cancellationToken);
            return schedule == null ? NotFound() : Ok(schedule);
        }

        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<ActionResult<ClassScheduleDetailDto>> CreateSchedule(
            CreateClassScheduleRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var schedule = await _scheduleService.CreateScheduleAsync(request, cancellationToken);
                return CreatedAtAction(nameof(GetSchedule), new { scheduleId = schedule.Id }, schedule);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{scheduleId}")]
        public async Task<ActionResult<ClassScheduleDetailDto>> UpdateSchedule(
            string scheduleId,
            UpdateClassScheduleRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var schedule = await _scheduleService.UpdateScheduleAsync(scheduleId, request, cancellationToken);
                return schedule == null ? NotFound() : Ok(schedule);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{scheduleId}")]
        public async Task<IActionResult> DeleteSchedule(string scheduleId, CancellationToken cancellationToken)
        {
            var deleted = await _scheduleService.DeleteScheduleAsync(scheduleId, cancellationToken);
            return deleted ? NoContent() : NotFound();
        }

        [Authorize(Roles = "User")]
        [HttpPost("{scheduleId}/attendance")]
        public async Task<ActionResult<ScheduleAttendanceDto>> CreateMyAttendance(
            string scheduleId,
            UpsertScheduleAttendanceRequest request,
            CancellationToken cancellationToken)
        {
            return await UpsertMyAttendance(scheduleId, request, cancellationToken);
        }

        [Authorize(Roles = "User")]
        [HttpPut("{scheduleId}/attendance")]
        public async Task<ActionResult<ScheduleAttendanceDto>> UpdateMyAttendance(
            string scheduleId,
            UpsertScheduleAttendanceRequest request,
            CancellationToken cancellationToken)
        {
            return await UpsertMyAttendance(scheduleId, request, cancellationToken);
        }

        private async Task<ActionResult<ScheduleAttendanceDto>> UpsertMyAttendance(
            string scheduleId,
            UpsertScheduleAttendanceRequest request,
            CancellationToken cancellationToken)
        {
            try
            {
                var attendance = await _scheduleService.UpsertMyAttendanceAsync(scheduleId, request, cancellationToken);
                return attendance == null ? NotFound() : Ok(attendance);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }
    }
}
