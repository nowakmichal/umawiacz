# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend (Angular)
npm start          # dev server at http://localhost:4200 (proxies /api → :5000)
npm run build      # production build (SSR)
npm test           # run tests with Vitest
npm run watch      # dev build with file watching
npm run serve:ssr:umawiacz  # run the built SSR server (port 4000 or $PORT)

# Backend (C# API)
cd api && dotnet run   # API at http://localhost:5000
```

To run a single test file: `npx ng test --include="src/app/calendar/**/*.spec.ts"`

Run both simultaneously: start the C# API first (`cd api && dotnet run`), then the Angular dev server (`npm start`).

## Architecture

**C# backend** (`api/`): ASP.NET Core 9 minimal-API with EF Core InMemory. Endpoints:
- `GET /api/periods` — list all periods (all users)
- `POST /api/periods` — create a period `{ start, end, color, userName }`
- `DELETE /api/periods/{id}` — delete a period by id

The frontend's `PeriodService` uses relative URL `/api/periods`. In dev mode, `proxy.conf.json` forwards these calls from the Angular dev server (`:4200`) to the C# API (`:5000`). In SSR/production mode, `src/server.ts` does the same forwarding. Override the target with the `API_URL` env var.

**Angular 21 SSR app** with Express server. Entry points:
- `src/main.ts` — browser bootstrap
- `src/main.server.ts` — server bootstrap
- `src/server.ts` — Express app wrapping Angular SSR engine

**App config** (`src/app/app.config.ts`): uses `provideClientHydration(withEventReplay())` for SSR hydration.

**Routing** (`src/app/app.routes.ts`): `/` redirects to `/calendar`; add new routes here.

**Components**: standalone, signal-based state (`signal`, `computed`). New components use SCSS by default (set in `angular.json` schematics). Templates use Angular's `@for`/`@if` control-flow syntax (not `*ngFor`/`*ngIf` directives).

**Locale**: Polish (pl-PL) — date labels and UI text are in Polish.

## Code Style

Prettier is configured in `package.json`: `printWidth: 100`, `singleQuote: true`, angular HTML parser for `.html` files.

TypeScript strict mode is fully enabled (`strict`, `noImplicitOverride`, `noImplicitReturns`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`). Angular strict templates and strict injection parameters are also on.

## Testing

Tests use Vitest (via `@angular/build:unit-test`). Test files are `*.spec.ts` under `src/`. The `vitest/globals` types are included in `tsconfig.spec.json`.
