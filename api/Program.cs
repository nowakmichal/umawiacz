using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using Umawiacz.Api;
using Umawiacz.Api.Models;

var builder = WebApplication.CreateBuilder(args);

// ── In-memory database ──────────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseInMemoryDatabase("UmawiaczDb"));

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

app.UseCors();

// ── GET /api/periods ─────────────────────────────────────────────────────────
app.MapGet("/api/periods", async (AppDbContext db) =>
    Results.Ok(await db.Periods.OrderBy(p => p.Start).ThenBy(p => p.UserName).ToListAsync()));

// ── POST /api/periods ────────────────────────────────────────────────────────
app.MapPost("/api/periods", async (CreateTimePeriodRequest req, AppDbContext db) =>
{
    if (string.IsNullOrWhiteSpace(req.UserName))
        return Results.BadRequest(new { error = "UserName is required." });

    if (req.Color is not ("green" or "orange" or "red"))
        return Results.BadRequest(new { error = "Color must be 'green', 'orange', or 'red'." });

    if (!DateOnly.TryParse(req.Start, out _) || !DateOnly.TryParse(req.End, out _))
        return Results.BadRequest(new { error = "Start and End must be valid dates (YYYY-MM-DD)." });

    if (string.Compare(req.Start, req.End, StringComparison.Ordinal) > 0)
        return Results.BadRequest(new { error = "Start must not be after End." });

    // A user may not mark any day they have already marked
    var overlap = await db.Periods.AnyAsync(p =>
        p.UserName == req.UserName &&
        string.Compare(p.Start, req.End, StringComparison.Ordinal) <= 0 &&
        string.Compare(p.End, req.Start, StringComparison.Ordinal) >= 0);

    if (overlap)
        return Results.Conflict(new { error = "You have already marked one or more days in this range." });

    var period = new TimePeriod
    {
        Id = Guid.NewGuid().ToString(),
        Start = req.Start,
        End = req.End,
        Color = req.Color,
        UserName = req.UserName,
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

app.Run();
