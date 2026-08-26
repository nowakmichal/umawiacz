namespace Umawiacz.Api.Models;

public class Event
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string StartDate { get; set; } = string.Empty; // YYYY-MM-DD
    public string EndDate { get; set; } = string.Empty;   // YYYY-MM-DD
    public string Description { get; set; } = string.Empty;
}
