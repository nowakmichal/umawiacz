# Umawiacz

A small calendar app for marking availability periods on a shared calendar.
Angular 21 (SSR) frontend + C# ASP.NET Core backend. UI is in Polish (locale `pl-PL`).

## Stack

| Layer     | Tech                                                    |
|-----------|---------------------------------------------------------|
| Frontend  | Angular 21, SSR (Express), standalone components, SCSS, Polish UI |
| Backend   | C# ASP.NET Core `net10.0` minimal API, EF Core InMemory |
| Testing   | Vitest (via `@angular/build:unit-test`)                 |
| Deploy    | Docker / docker-compose (optional)                       |

## Getting started

Requires: Node.js 20+, .NET 10 SDK.

### 1. Install & run the backend

```bash
cd api
dotnet run          # API on http://localhost:5000
```

### 2. Run the frontend

```bash
npm install
npm start           # Angular dev server on http://localhost:4200
```

The dev server proxies `/api/*` → `:5000` (see `proxy.conf.json`).

## API

Base: `http://localhost:5000`

| Method | Path               | Body                                  | Notes                                  |
|--------|--------------------|---------------------------------------|----------------------------------------|
| GET    | `/api/periods`     | —                                     | list all periods                       |
| POST   | `/api/periods`     | `{ start, end, color, userName }`     | 409 on range overlap for same user     |
| DELETE | `/api/periods/{id}`| —                                     | 404 if missing                         |
| POST   | `/api/login`       | `{ username, password }`              | hardcoded `test` / `test` (demo)       |

`color` is one of `green | orange | red`; `start`/`end` are `YYYY-MM-DD`.

## Scripts

```bash
npm start                     # dev server (:4200, proxies /api)
npm test                      # all tests (Vitest)
npm test -- --watch=false     # single run
npx ng test --include="src/app/calendar/**/*.spec.ts"  # one spec file
npm run build                 # SSR production build -> dist/
npm run serve:ssr:umawiacz    # run built SSR server (port 4000 or $PORT)
npm run watch                 # watch dev build
```

## Production / Docker

```bash
npm run build                 # produce dist/ (browser + server)
API_URL=http://api:5000 npm run serve:ssr:umawiacz
```

Or run it all with docker-compose:

```bash
docker compose up --build     # frontend on :4000, API internal on :5000
```

The SSR server reads `API_URL` (default `http://localhost:5000`) for its `/api` proxy.

## Project layout

```
api/                  C# minimal API (Program.cs, Models/, AppDbContext.cs)
src/app/
  calendar/           main shared-calendar component
  home/               home component
  login/              login form
  guards/             auth guard
  services/           HTTP services (period, auth, login)
  models/             shared TS models
  app.routes.ts       routes
src/server.ts         Express SSR wrapper + /api proxy
proxy.conf.json       dev-server /api -> :5000 proxy
```
