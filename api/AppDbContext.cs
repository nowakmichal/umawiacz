using Microsoft.EntityFrameworkCore;
using Umawiacz.Api.Models;

namespace Umawiacz.Api;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<Event> Events => Set<Event>();
    public DbSet<Period> Periods => Set<Period>();
    public DbSet<User> Users => Set<User>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.Entity<Period>()
            .HasOne(p => p.Event)
            .WithMany()
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<Period>()
            .HasOne(p => p.User)
            .WithMany()
            .OnDelete(DeleteBehavior.Cascade);

        builder.Entity<User>()
            .HasIndex(u => u.Name)
            .IsUnique();

        builder.Entity<Period>()
            .HasIndex(p => new { p.EventId, p.UserId });
    }
}
