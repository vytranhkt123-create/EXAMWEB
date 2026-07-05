using ExamWeb.Application.DTO.OnlineClass;
using ExamWeb.Application.IService;
using ExamWeb.Domain.DomainExceptions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace ExamWeb.Server.Controllers
{
    [ApiController]
    [Route("api/materials")]
    [Authorize(Roles = "Admin,User")]
    public class MaterialsController : ControllerBase
    {
        private readonly IOnlineClassService _onlineClassService;

        public MaterialsController(IOnlineClassService onlineClassService)
        {
            _onlineClassService = onlineClassService;
        }

        [HttpGet]
        public async Task<ActionResult<IReadOnlyList<MaterialDto>>> GetMaterials(CancellationToken cancellationToken)
        {
            var materials = await _onlineClassService.GetMaterialsAsync(cancellationToken);
            return Ok(materials);
        }

        [HttpGet("{materialId}/file")]
        public async Task<IActionResult> GetMaterialFile(string materialId, CancellationToken cancellationToken)
        {
            var material = await _onlineClassService.GetMaterialFileAsync(materialId, cancellationToken);
            if (material == null)
            {
                return NotFound();
            }

            Response.Headers.ContentDisposition = BuildInlineContentDisposition(material.FileName);
            Response.Headers.XContentTypeOptions = "nosniff";
            return File(material.Content, material.ContentType, enableRangeProcessing: true);
        }

        [Authorize(Roles = "Admin")]
        [HttpPost]
        [RequestSizeLimit(52428800)]
        public async Task<ActionResult<MaterialDto>> CreateMaterial(CreateMaterialRequest request, CancellationToken cancellationToken)
        {
            try
            {
                var material = await _onlineClassService.CreateMaterialAsync(request, cancellationToken);
                return CreatedAtAction(nameof(GetMaterials), new { id = material.Id }, material);
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        [Authorize(Roles = "Admin")]
        [HttpDelete("{materialId}")]
        public async Task<IActionResult> DeleteMaterial(string materialId, CancellationToken cancellationToken)
        {
            try
            {
                var deleted = await _onlineClassService.DeleteMaterialAsync(materialId, cancellationToken);
                return deleted ? NoContent() : NotFound();
            }
            catch (DomainException ex)
            {
                return BadRequest(new { message = ex.Message });
            }
        }

        private static string BuildInlineContentDisposition(string fileName)
        {
            var safeFileName = string.Concat(fileName.Where(ch => ch >= 32 && ch < 127 && ch != '"' && ch != '\\'));
            if (string.IsNullOrWhiteSpace(safeFileName))
            {
                safeFileName = "document.pdf";
            }

            return $"inline; filename=\"{safeFileName}\"; filename*=UTF-8''{Uri.EscapeDataString(fileName)}";
        }
    }
}
