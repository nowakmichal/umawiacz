# AGENTS.md

## Commands

```bash
npm start                     # Angular dev server :4200, proxies /api → :5000
npm test                      # run all tests (Vitest via @angular/build:unit-test)
npm test -- --watch=false     # single run (not --run)
npx ng test --include="src/app/calendar/**/*.spec.ts"  # single file
cd api && dotnet run          # C# backend :5000
npm run build                 # SSR production build → dist/
npm run serve:ssr:umawiacz    # run built SSR server (port 4000 or $PORT)
npm run watch                 # dev build with file watching
```

Run backend first (`dotnet run` in `api/`), then `npm start`.

## Architecture

- **Frontend**: Angular 21 SSR (Express). Standalone components, signal-based state, `@for`/`@if` control flow in templates. SCSS default.
- **Backend**: C# ASP.NET Core 10 minimal API with EF Core InMemory at `api/`. Endpoints: `GET/POST /api/periods`, `DELETE /api/periods/{id}`, `POST /api/login`.
- **Proxy**: Dev mode uses `proxy.conf.json` (Angular dev-server). SSR/production uses `src/server.ts` raw proxy. Override backend URL via `API_URL` env var.
- **Routing**: `src/app/app.routes.ts` — `/` redirects to `/calendar`, `/login` for login component, protected routes with auth guard.
- **Locale**: Polish (pl-PL) — all dates and UI text.

## Code style

- Prettier: `printWidth: 100`, `singleQuote: true`, angular HTML parser for `.html` files.
- TypeScript strict mode fully enabled (including `strictTemplates`, `strictInputAccessModifiers`).
- No comments in code unless the logic is non-obvious.

## Testing (Vitest, not Jasmine)

- Uses `@angular/build:unit-test` with Vitest v4.
- `tsconfig.spec.json` includes `"types": ["vitest/globals"]` — use `vi.fn()`, `vi.spyOn()`, not jasmine.
- **Mock localStorage** via `vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(...)` — direct `localStorage` spy fails on native API.
- **Mock HTTP** via `provideHttpClientTesting` + `HttpTestingController`.
- **Platform**: provide `{ provide: PLATFORM_ID, useValue: 'browser' }` in tests for components using `isPlatformBrowser`.
- Call `vi.clearAllMocks()` before setting up fresh spies in `beforeEach` to prevent cross-test leaks on prototype spies.

## Backend notes

- `.NET 10` target (`net10.0`), EF Core InMemory `10.0.*`.
- CORS allows only `localhost:4200` and `localhost:4000`.
- Username uniqueness enforced server-side (409 on overlap).
- Docker: `docker-compose.yml` runs both services; API port 5000 is internal only.
- API endpoints are located in `api/` directory with `Program.cs` as entry point.
- Login endpoint: `POST /api/login` with username/password validation (test/test for demo).

## Authentication

- Authentication is handled through the `/api/login` endpoint.
- After successful login, user is redirected to calendar page.
- The logged-in user's name is used in the calendar component for marking periods.
- If unauthenticated, users are redirected to the login page when trying to access protected routes.
- API endpoints are located in `api/` directory with `Program.cs` as entry point.
