namespace Umawiacz.Api.Models;

public record CreateEventRequest(string Name, string StartDate, string EndDate, string? Description);
