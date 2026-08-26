namespace Umawiacz.Api.Models;

public record EventCalendarResponse(Event Event, List<Period> Periods);
