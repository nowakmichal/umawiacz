# TODO

## 1. Normalize the database schema

- [x] Add a `User` entity (`Id`, `Name`) to `api/Models/` and register it in `AppDbContext`.
- [x] Rename `EventInfo` → `Event` and `TimePeriod` → `Period` (models + `AppDbContext` set names).
- [x] Wire relations: `Period.UserId` FK → `User` (replacing the raw `UserName` string), `Period.EventId` FK → `Event`, cascade delete from Event to its periods.
- [x] Add constraints: unique on `User.Name` (stored lowercase), index on `Period` (`EventId`, `UserId`).
- [x] Update `POST /api/login` to create-or-get the `User` row and return its `id`.
- [x] Update `POST /api/events/{id}/periods` to resolve the user by name and store `UserId`; keep the per-user, per-event overlap check (409).
- [x] Delete `api/umawiacz.db` and let `EnsureCreated()` rebuild the schema (no migrations in use).
- [x] Update frontend models (`event.model.ts`, `time-period.model.ts`, `login.model.ts`) to match the new JSON shape.

## 2. Check the Docker files

- [x] `api/Dockerfile`: verify restore-then-copy build works and `bin`/`obj` are excluded via `api/.dockerignore`. (Verified: single csproj, `dotnet publish -c Release` succeeds; `.dockerignore` excludes `bin/`, `obj/`, `umawiacz.db`, `data/`.)
- [x] `Dockerfile`: verify `npm run build` output path matches `COPY --from=builder /app/dist/umawiacz/`. (Verified: build outputs `dist/umawiacz/{browser,server}`, `server/server.mjs` present as the CMD target.)
- [x] `docker-compose.yml`: verify the SQLite volume (`./api/data` ↔ `Data Source=/app/data/umawiacz.db`) and the `API_URL` wiring for the SSR proxy. (Verified: `ConnectionStrings__UmawiaczDb` matches `GetConnectionString("UmawiaczDb")` in Program.cs; `API_URL` is read by `src/server.ts`.)
- [x] ~~Build both images and `docker compose up`~~ — Docker daemon unavailable in this environment; ran the local equivalents instead: built both artifacts (`dotnet publish`, `npm run build`) and smoke tested login → create event → add period → 409 on overlap → public calendar payload, plus SSR render + `/api` proxy on :4000 with `API_URL` set as in compose.

## 3. Review all code (frontend + backend)

- [x] Remove `src/app/home` (component + spec) — not referenced by any route.
- [x] Delete `api/bin` (incl. the stale `net9.0` artifacts) and `api/obj`; confirm `.gitignore` keeps them out.
- [x] Search for and remove dead code / hardcoded login leftovers (demo credentials, fallback usernames). (No demo credentials or fallback usernames existed; removed the dead `response.success` branch in `login.ts` and the unused `EventService.getEvent()`.)
- [x] Fix naming inconsistencies between frontend and backend (`EventInfo`/`TimePeriod` vs `Event`/`Period`). (Renamed frontend `EventInfo` → `Event`, `TimePeriod` → `Period`, `time-period.model.ts` → `period.model.ts`; kept `CreateTimePeriodRequest`/`CreateTimePeriodResponse` to match the backend DTO names.)
- [x] Verify all UI text stays in Polish (pl-PL locale, Polish dates).
- [x] Update `AGENTS.md` if endpoints, models, or architecture change. (Verified: endpoints, routing, and locale notes are current — no changes needed.)

## 4. Verify

- [x] `npm test -- --watch=false` finishes fully green (exit code 0, no unhandled errors). (6 files, 58 tests passed.)
- [x] `npm run build` (SSR production build) passes. (AOT + 4 prerendered routes.)
- [x] Start the backend and smoke test the endpoints: event create/list/get, period 409 on overlap, 404s for unknown ids, public calendar payload. (All passed: login 200, event create 201, list/get 200, period create 201, overlap 409, unknown id/calendar 404, public calendar 200 with `{ event, periods }`. Test data removed afterwards.)
