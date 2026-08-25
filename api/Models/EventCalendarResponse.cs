namespace Umawiacz.Api.Models;

public record EventCalendarResponse(EventInfo Event, List<TimePeriod> Periods);
