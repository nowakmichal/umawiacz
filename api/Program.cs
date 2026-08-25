using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Umawiacz.Api;
using Umawiacz.Api.Models;

var builder = WebApplication.CreateBuilder(args);

// ── SQLite database (file under api/, see ConnectionStrings in appsettings.json) ──
var connectionString = builder.Configuration.GetConnectionString("UmawiaczDb")
    ?? throw new InvalidOperationException("Connection string 'UmawiaczDb' is missing.");

var dataSource = new SqliteConnectionStringBuilder(connectionString).DataSource;
var dbDirectory = Path.GetDirectoryName(Path.GetFullPath(dataSource));
if (!string.IsNullOrEmpty(dbDirectory))
    Directory.CreateDirectory(dbDirectory);

builder.Services.AddDbContext<AppDbContext>(opt => opt.UseSqlite(connectionString));

// ── JSON: camelCase to match the Angular frontend ───────────────────────────
builder.Services.ConfigureHttpJsonOptions(opts =>
{
    opts.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    opts.SerializerOptions.PropertyNameCaseInsensitive = true;
});

// ── CORS: allow the Angular dev server and SSR server ───────────────────────
builder.Services.AddCors(opts =>
    opts.AddDefaultPolicy(policy =>
        policy
            .WithOrigins("http://localhost:4200", "http://localhost:4000")
            .AllowAnyMethod()
            .AllowAnyHeader()));

var app = builder.Build();

// ── Create the SQLite database on first run ─────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

app.UseCors();

// ── GET /api/events ──────────────────────────────────────────────────────────
app.MapGet("/api/events", async (AppDbContext db) =>
    Results.Ok(await db.Events.OrderBy(e => e.StartDate).ToListAsync()));

// ── POST /api/events ─────────────────────────────────────────────────────────
app.MapPost("/api/events", async (CreateEventRequest req, AppDbContext db) =>
{
    var name = req.Name?.Trim() ?? string.Empty;
    if (name.Length == 0)
        return Results.BadRequest(new { error = "Name is required." });

    if (!DateOnly.TryParse(req.StartDate, out _) || !DateOnly.TryParse(req.EndDate, out _))
        return Results.BadRequest(new { error = "StartDate and EndDate must be valid dates (YYYY-MM-DD)." });

    if (string.Compare(req.StartDate, req.EndDate, StringComparison.Ordinal) > 0)
        return Results.BadRequest(new { error = "StartDate must not be after EndDate." });

    var evt = new EventInfo
    {
        Id = Guid.NewGuid().ToString(),
        Name = name,
        StartDate = req.StartDate,
        EndDate = req.EndDate,
        Description = req.Description?.Trim() ?? string.Empty,
    };

    db.Events.Add(evt);
    await db.SaveChangesAsync();

    return Results.Created($"/api/events/{evt.Id}", evt);
});

// ── GET /api/events/{id} ─────────────────────────────────────────────────────
app.MapGet("/api/events/{id}", async (string id, AppDbContext db) =>
{
    var evt = await db.Events.FindAsync(id);
    if (evt is null) return Results.NotFound();
    return Results.Ok(evt);
});

// ── GET /api/events/{id}/calendar (public, for the shareable link) ───────────
app.MapGet("/api/events/{id}/calendar", async (string id, AppDbContext db) =>
{
    var evt = await db.Events.FindAsync(id);
    if (evt is null) return Results.NotFound();

    var periods = await db.Periods.Where(p => p.EventId == id)
        .OrderBy(p => p.Start).ThenBy(p => p.UserName).ToListAsync();

    return Results.Ok(new EventCalendarResponse(evt, periods));
});

// ── GET /api/events/{id}/periods ─────────────────────────────────────────────
app.MapGet("/api/events/{id}/periods", async (string id, AppDbContext db) =>
{
    var exists = await db.Events.AnyAsync(e => e.Id == id);
    if (!exists) return Results.NotFound();

    return Results.Ok(await db.Periods.Where(p => p.EventId == id)
        .OrderBy(p => p.Start).ThenBy(p => p.UserName).ToListAsync());
});

// ── POST /api/events/{id}/periods ────────────────────────────────────────────
app.MapPost("/api/events/{id}/periods", async (string id, CreateTimePeriodRequest req, AppDbContext db) =>
{
    var evt = await db.Events.FindAsync(id);
    if (evt is null) return Results.NotFound();

    if (string.IsNullOrWhiteSpace(req.UserName))
        return Results.BadRequest(new { error = "UserName is required." });

    var userName = req.UserName.Trim().ToLowerInvariant();

    if (req.Color is not ("green" or "orange" or "red"))
        return Results.BadRequest(new { error = "Color must be 'green', 'orange', or 'red'." });

    if (!DateOnly.TryParse(req.Start, out _) || !DateOnly.TryParse(req.End, out _))
        return Results.BadRequest(new { error = "Start and End must be valid dates (YYYY-MM-DD)." });

    if (string.Compare(req.Start, req.End, StringComparison.Ordinal) > 0)
        return Results.BadRequest(new { error = "Start must not be after End." });

    // A user may not mark any day they have already marked within an event
    // YYYY-MM-DD dates compare correctly with lexicographic order
    var userPeriods = await db.Periods
        .Where(p => p.EventId == id && p.UserName == userName).ToListAsync();
    var overlap = userPeriods.Any(p =>
        string.Compare(p.Start, req.End, StringComparison.Ordinal) <= 0 &&
        string.Compare(p.End, req.Start, StringComparison.Ordinal) >= 0);

    if (overlap)
        return Results.Conflict(new { error = "You have already marked one or more days in this range." });

    var period = new TimePeriod
    {
        Id = Guid.NewGuid().ToString(),
        EventId = id,
        Start = req.Start,
        End = req.End,
        Color = req.Color,
        UserName = userName,
    };

    db.Periods.Add(period);
    await db.SaveChangesAsync();

    return Results.Created($"/api/periods/{period.Id}", period);
});

// ── DELETE /api/periods/{id} ─────────────────────────────────────────────────
app.MapDelete("/api/periods/{id}", async (string id, AppDbContext db) =>
{
    var period = await db.Periods.FindAsync(id);
    if (period is null) return Results.NotFound();

    db.Periods.Remove(period);
    await db.SaveChangesAsync();

    return Results.NoContent();
});

// ── POST /api/login ──────────────────────────────────────────────────────────
app.MapPost("/api/login", (LoginRequest request) =>
{
    var username = request.Username?.Trim().ToLowerInvariant() ?? string.Empty;
    if (username.Length == 0)
        return Results.BadRequest(new { error = "Username is required." });

    return Results.Ok(new LoginResponse
    {
        Username = username,
        Success = true,
    });
});

app.Run();
