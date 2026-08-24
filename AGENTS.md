# AGENTS.md

## Commands

```bash
npm start                     # Angular dev server :4200 (proxies /api -> :5000 via proxy.conf.json)
npm test                      # run all tests (Vitest, jsdom)
npm test -- --watch=false     # single run (flag is --watch=false, NOT --run)
npx ng test --include="src/app/calendar/**/*.spec.ts"  # single file
cd api && dotnet run          # C# backend on :5000
npm run build                 # SSR production build -> dist/
npm run serve:ssr:umawiacz    # run built SSR server (port 4000 or $PORT)
npm run watch                 # dev build with file watching
```

Start backend first (`cd api && dotnet run`), then `npm start`.

## Architecture

- **Frontend**: Angular 21 SSR (Express). Standalone components, signal-based state, `@for`/`@if` control flow, SCSS.
- **Backend**: C# ASP.NET Core `net10.0` minimal API with EF Core InMemory at `api/` (entry `api/Program.cs`). Endpoints: `GET/POST /api/periods`, `DELETE /api/periods/{id}`, `POST /api/login`.
- **Proxy**: dev = `proxy.conf.json` (Angular dev-server); SSR/prod = `src/server.ts` raw proxy. Override backend URL with `API_URL` env var.
- **Routing**: `src/app/app.routes.ts` — `/` redirects to `/calendar`, `/login` for login, protected routes use the auth guard (`src/app/guards/auth.guard.ts`).
- **Locale**: Polish (pl-PL) — all dates and UI text.

## Code style

- Prettier: `printWidth: 100`, `singleQuote: true`, angular HTML parser for `.html`.
- TypeScript strict mode fully enabled (incl. `strictTemplates`, `strictInputAccessModifiers`).
- No comments unless the logic is non-obvious.

## Testing (Vitest, not Jasmine)

- `@angular/build:unit-test` with Vitest v4; `tsconfig.spec.json` sets `types: ["vitest/globals"]` — use `vi.fn()`, `vi.spyOn()`.
- **Mock localStorage** via `vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(...)` — spying the `localStorage` object directly fails on the native API.
- **Mock HTTP** with `provideHttpClientTesting` + `HttpTestingController`.
- **Platform**: components that use `isPlatformBrowser` (e.g. calendar) need `{ provide: PLATFORM_ID, useValue: 'browser' }` in the test TestBed.
- Call `vi.clearAllMocks()` before setting fresh prototype spies in `beforeEach` to avoid cross-test leaks.
- **The suite exits 1 even when all tests pass.** `Calendar.ngOnInit` calls `router.navigate(['/login'])` when unauthenticated (`calendar.ts`); Angular 21's `Router` is `providedIn: 'root'`, so TestBed resolves a router with no routes, and each unauthenticated component init leaves an unhandled NG04002 rejection that Vitest counts as an "error" (baseline: 27 errors). Judge success by the `Tests N passed (N)` line, not the exit code — don't mistake the baseline for a regression.

## Backend notes

- `.NET 10` (`net10.0`), EF Core InMemory `10.0.*`. JSON is camelCase (matches the Angular models).
- CORS allows only `http://localhost:4200` and `http://localhost:4000`.
- `POST /api/periods` rejects overlapping dates per user (409) and validates color in `green|orange|red`, dates in `YYYY-MM-DD`, `start <= end`.
- `POST /api/login` is username-only (no password); the username is normalized (trim + lowercase) so the same name case-insensitively maps to the same user. `POST /api/periods` normalizes `userName` the same way before the overlap check and storage.
- Active user comes from the in-memory `AuthService` signal (not persisted across reloads); the `umawiacz_username` localStorage key is written by the calendar's manual username entry. Calendar polls `/api/periods` every 15s.
- Docker: `docker-compose.yml` runs both; API port 5000 is internal only, frontend exposed on 4000 with `API_URL=http://api:5000`.

## Note

`agents.md` (lowercase) is unrelated — it documents app "agent types," not coding-agent instructions.
