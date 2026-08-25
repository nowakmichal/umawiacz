namespace Umawiacz.Api.Models;

public class TimePeriod
{
    public string Id { get; set; } = string.Empty;
    public string EventId { get; set; } = string.Empty;
    public string Start { get; set; } = string.Empty;   // YYYY-MM-DD
    public string End { get; set; } = string.Empty;     // YYYY-MM-DD
    public string Color { get; set; } = string.Empty;   // green | orange | red
    public string UserName { get; set; } = string.Empty;
}
