namespace Umawiacz.Api.Models;

public class Period
{
    public string Id { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string UserId { get; set; } = string.Empty;
    public string Start { get; set; } = string.Empty;   // YYYY-MM-DD
    public string End { get; set; } = string.Empty;     // YYYY-MM-DD
    public string Color { get; set; } = string.Empty;   // green | red
    public Event Event { get; set; } = null!;
    public User User { get; set; } = null!;

    public string UserName => User?.Name ?? string.Empty;
}
