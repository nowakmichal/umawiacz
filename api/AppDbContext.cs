using Microsoft.EntityFrameworkCore;
using Umawiacz.Api.Models;

namespace Umawiacz.Api;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<TimePeriod> Periods => Set<TimePeriod>();
}
