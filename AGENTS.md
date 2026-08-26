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
- **Backend**: C# ASP.NET Core `net10.0` minimal API with EF Core SQLite at `api/` (entry `api/Program.cs`). Endpoints: `GET/POST /api/events`, `GET /api/events/{id}`, `GET /api/events/{id}/calendar` (public, `{ event, periods }` for the shareable link), `GET/POST /api/events/{id}/periods`, `DELETE /api/periods/{id}`, `POST /api/login`.
- **Proxy**: dev = `proxy.conf.json` (Angular dev-server); SSR/prod = `src/server.ts` raw proxy. Override backend URL with `API_URL` env var.
- **Routing**: `src/app/app.routes.ts` — `/` redirects to `/events`; `events` is the event list/create screen (protected by the auth guard, `src/app/guards/auth.guard.ts`); `calendar/:eventId` is the **public** event calendar (no guard, SSR'd on demand via `app.routes.server.ts`, never prerendered); `login` for login.
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
- The suite must finish fully green: exit code 0 and `Tests N passed (N)` with no unhandled errors. (The old NG04002 baseline — unhandled rejections from `Calendar.ngOnInit` navigating to `/login` when unauthenticated — is gone: `/calendar/:eventId` is public now and never navigates to login.)

## Backend notes

- `.NET 10` (`net10.0`), EF Core SQLite `10.0.*` (file `api/umawiacz.db`, `EnsureCreated()` on startup — delete the file to reset the schema). JSON is camelCase (matches the Angular models).
- CORS allows only `http://localhost:4200` and `http://localhost:4000`.
- `POST /api/events` validates a non-empty `name` and `YYYY-MM-DD` dates with `start <= end` (400 otherwise). `GET /api/events/{id}` and `GET /api/events/{id}/calendar` return 404 for an unknown id; `GET /api/events/{id}/calendar` is the public one-shot load for the shareable link and returns `{ event, periods }`.
- Periods are scoped to an event: `POST /api/events/{id}/periods` returns 404 for an unknown event, rejects overlapping dates per user **within that event** (409), and validates color in `green|orange|red`, dates in `YYYY-MM-DD`, `start <= end`. `DELETE /api/periods/{id}` and `POST /api/login` are event-agnostic.
- `POST /api/login` is username-only (no password); the username is normalized (trim + lowercase) so the same name case-insensitively maps to the same user. `POST /api/events/{id}/periods` normalizes `userName` the same way before the overlap check and storage.
- Active user comes from the in-memory `AuthService` signal (not persisted across reloads); the `umawiacz_username` localStorage key is written by the public calendar's guest-name entry. The calendar (public, no login) polls `/api/events/{eventId}/periods` every 15s.
- Docker: `docker-compose.yml` runs both; API port 5000 is internal only, frontend exposed on 4000 with `API_URL=http://api:5000`.

## Note

`agents.md` (lowercase) is unrelated — it documents app "agent types," not coding-agent instructions.
