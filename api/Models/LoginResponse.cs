namespace Umawiacz.Api.Models;

public class LoginResponse
{
    public string Id { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public bool Success { get; set; }
}