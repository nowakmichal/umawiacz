# TODO

## 1. ~~Replace password login with username-only login~~ — DONE

- Remove password from the login flow entirely (no `Password` field in `LoginRequest`, no password check in `POST /api/login`).
- Login is username only, case-insensitive: `test`, `Test`, `TEST` are all the same user.
- Normalize username (e.g. lowercase) on login and when storing/comparing `UserName` on periods, so the same user is always treated as the same user.
- Frontend: remove the password field from the login form and stop sending it; adjust `AuthService` and related UI.
- Files to touch: `api/Program.cs`, `api/Models/LoginRequest.cs`, `src/app` login screen and auth service.

## 2. ~~Switch from InMemory database to SQLite~~ — DONE

- Replace `UseInMemoryDatabase("UmawiaczDb")` with SQLite (connection string, file in `api/`).
- Create the database on startup if it does not exist (e.g. `EnsureCreated()` or a migration).
- Update `api/Umawiacz.Api.csproj` (drop `Microsoft.EntityFrameworkCore.InMemory`, add `Microsoft.EntityFrameworkCore.Sqlite`), `AppDbContext` configuration, `appsettings.json`, and the Docker setup (volume mount for the DB file).
- Verify all endpoints (`GET/POST/DELETE /api/periods`) work against SQLite and existing tests still pass.

## 3. Add event functionality

- New screen where the user can generate a new instance of an event (name, dates, options).
- When an event is created, it generates a calendar tied to a specific shareable link (e.g. `/calendar/:eventId`) that can be sent to users.
- Each event must have separate calendar period objects — periods are scoped to an event, not to the user's global calendar.
- Backend: new `Event` entity, endpoints to create/get events, scope `periods` endpoints by event id, endpoint to fetch a public calendar by event link.
- Frontend: event creation screen, route for the shared event calendar view (no login required to view), calendar page showing the event's periods.

## 4. Refactor and review

- Normalize the database schema (entities: `User`, `Event`, `Period` with proper relations/unique constraints; no duplicated data, consistent naming).
- Check the Docker files: `Dockerfile`, `api/Dockerfile`, `docker-compose.yml` — correct build, ports, volumes for the SQLite file, `API_URL` wiring.
- Review all code in the app (frontend and backend): remove dead code (e.g. hardcoded login leftovers, net9.0 build artifacts in `api/bin`), fix inconsistencies, clean up naming, keep Polish locale for all UI text.
- Run `npm test -- --watch=false` and the backend after changes to confirm nothing is broken.
