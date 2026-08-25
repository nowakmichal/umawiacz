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

Spec: a screen to create an event (name, dates, description); each event gets a calendar tied to a shareable link `/calendar/:eventId` that can be sent to users; periods are scoped per event, not to a global user calendar; viewing an event calendar requires no login.

### 3.1 ~~Backend: `Event` entity and models~~ — DONE

- `api/Models/EventInfo.cs` (Id, Name, StartDate, EndDate, Description), `api/Models/CreateEventRequest.cs` (record), `api/Models/EventCalendarResponse.cs` (record: event + periods).
- `api/Models/TimePeriod.cs` gained `EventId`; `api/AppDbContext.cs` gained `DbSet<EventInfo> Events`.
- Old dev DB deleted (`api/umawiacz.db`); `EnsureCreated()` rebuilds the schema on next run.
- Verify: `cd api && dotnet build` → 0 warnings, 0 errors.

### 3.2 ~~Backend: event endpoints + event-scoped period endpoints~~ — DONE

- `GET /api/events`, `POST /api/events` (validates name, `YYYY-MM-DD` dates, start ≤ end), `GET /api/events/{id}` (404 for unknown).
- `GET /api/events/{id}/calendar` — **public**, returns `{ event, periods }` for the shareable link (404 for unknown).
- `GET /api/events/{id}/periods`, `POST /api/events/{id}/periods` — 404 for unknown event; `userName` trimmed + lowercased; overlap check scoped to event + user (409).
- `DELETE /api/periods/{id}` and `POST /api/login` unchanged.
- Verify: `cd api && dotnet build`; curl each endpoint against a running backend.

### 3.3 ~~Frontend: event models and services~~ — DONE

- `src/app/models/event.model.ts`: `EventInfo`, `CreateEventRequest`, `EventCalendar { event, periods }`.
- `src/app/models/time-period.model.ts`: `TimePeriod` gained `eventId: string` (note the field is `userName`, capital N — matches the backend JSON).
- `src/app/services/event.service.ts`: `getEvents()`, `getEvent(id)`, `getEventCalendar(id)`, `createEvent(req)`.
- `src/app/services/period.service.ts`: `getPeriods(eventId)` → GET `/api/events/{eventId}/periods`; `createPeriod(eventId, req)` → POST `/api/events/{eventId}/periods`; `deletePeriod(id)` unchanged.
- Verify: `npx tsc --noEmit -p tsconfig.app.json` (the app build won't catch these — they are only reachable via specs until 3.5).

### 3.4 ~~Frontend: events screen (list + create)~~ — DONE

- `src/app/events/events.ts` — `EventList` component: event list (name, date range, description), "Otwórz kalendarz", "Kopiuj link" (clipboard + "Skopiowano!" feedback), create form (name, start, end, optional description) with client-side validation and error banner, loading/empty states. All UI text in Polish.
- `src/app/events/events.html`, `src/app/events/events.scss` — styles consistent with the calendar screen (white cards, `#2563eb` primary).
- Not wired into routing yet (see 3.5).
- Verify: `npx tsc --noEmit -p tsconfig.app.json` — passes.

### 3.5 ~~Frontend: routing + login redirect~~ — DONE

Files: `src/app/app.routes.ts`, `src/app/app.routes.server.ts`, `src/app/login/login.ts`.

- `app.routes.ts`:
  - `''` → `redirectTo: 'events'` (full match).
  - `calendar` (no param) → `redirectTo: 'events'` (legacy link).
  - `events` → `loadComponent` `EventList`, `canActivate: [authGuard]`.
  - `calendar/:eventId` → `Calendar`, **public — no guard**.
  - `login` → `LoginComponent`.
- `app.routes.server.ts`: add explicit `{ path: 'calendar/:eventId', renderMode: RenderMode.SSR, component: Calendar }` before the existing `{ path: '**', renderMode: RenderMode.Prerender }` (the param route must be SSR'd on demand, never prerendered).
- `login.ts`: after successful login, navigate to `/events` instead of `/calendar`.
- Acceptance: `npm run build` passes; with `npm start`: `/` unauthenticated → `/login`; `/events` unauthenticated → `/login`; `/calendar/<any-id>` renders without login.

### 3.6 ~~Frontend: event-aware public calendar~~ — DONE

Files: `src/app/calendar/calendar.ts` (full rewrite), `calendar.html`, `calendar.scss`. Note: `calendar.ts` currently has 6 TS errors against the new `PeriodService`/`TimePeriod` signatures — this task fixes them.

- `calendar.ts`:
  - `eventId` from `ActivatedRoute.snapshot.paramMap.get('eventId')`.
  - One-shot load via `EventService.getEventCalendar(eventId)` → signals `eventInfo` + `periods`; on error set `eventError` (404 → "Nie znaleziono wydarzenia. Sprawdź, czy link jest poprawny.", other → generic) and render an error panel instead of the calendar.
  - Keep 15 s polling, now `periodService.getPeriods(eventId)` via `interval` + `startWith(0)` + `switchMap` + `takeUntilDestroyed`; silently ignore poll errors.
  - `currentUser`: logged-in `AuthService.currentUser()?.username`, else `localStorage.getItem('umawiacz_username')`, else `null` → existing guest name modal (unchanged flow; `confirmUsername` still writes `umawiacz_username`).
  - `onDayClick` → `periodService.createPeriod(eventId, …)`; the offline fallback local period object must include `eventId`.
  - New: `copyLink()` → `navigator.clipboard?.writeText(${window.location.origin}/calendar/${eventId})` with a temporary "Skopiowano!" state.
  - `logout()` → `authService.logout()` + `currentUser.set(null)` — user stays on the page as a guest, **no navigation** (page is public now).
  - Remove the `router.navigate(['/login'])` calls — the page no longer requires auth. This changes the NG04002 test-error baseline in AGENTS.md (see 3.8).
- `calendar.html`:
  - Wrap: `@if (eventError())` → centered error card (message + `routerLink` "Przejdź do wydarzeń" → `/events`); `@else` → existing shell.
  - New top bar in the shell: `routerLink` "Moje wydarzenia" → `/events` (left) and "Kopiuj link" button (right).
  - New event header block below the top bar: event name (`h1`), date range formatted `pl-PL` (single date if start == end, e.g. `15.06.2026`, else `01.06.2026 – 15.06.2026`), optional description line.
  - Existing content (month nav, color toolbar, grid, tooltip, username modal) unchanged otherwise; the username modal still shows when `!currentUser()`.
- `calendar.scss`: styles for the top bar, event header, and error card using the existing palette (`#111827`, `#6b7280`, `#2563eb`, `#fef2f2`/`#fecaca` error tones).
- Acceptance: `npm run build` passes; guest opens `/calendar/<id>` → name modal → can add a period; unknown id → error panel, no infinite error spam (poll failures silent).

### 3.7 Frontend: tests

Files: `src/app/calendar/calendar.spec.ts` (update), `src/app/services/period.service.spec.ts` (update), `src/app/services/event.service.spec.ts` (new), `src/app/events/events.spec.ts` (new).

- `calendar.spec.ts`: provide mocked `ActivatedRoute` (`snapshot.paramMap` → `eventId`, e.g. `'test-event'`), mock `EventService` (`getEventCalendar` success fixture `{ event, periods }` + a 404 case), update `PeriodService` mocks to new signatures (`getPeriods(eventId)`, `createPeriod(eventId, req)`), add `eventId` to all `TimePeriod` fixtures. Keep existing coverage (selection flow, color change, removal, touch swallow, guest modal) and add: loads event via `getEventCalendar(eventId)`; 404 → error panel; `copyLink` sets the copied state; logout clears `currentUser` without navigation.
- `period.service.spec.ts`: expect `/api/events/{eventId}/periods` URLs; `deletePeriod` expectations unchanged.
- `event.service.spec.ts`: `getEvents` / `getEvent` / `getEventCalendar` / `createEvent` hit the right URLs (pattern of `period.service.spec.ts`).
- `events.spec.ts`: `EventList` — loads on init, empty state, create validation errors, successful create appends + resets form, `openEvent` navigates to `/calendar/<id>` (mock `Router`).
- Conventions (see AGENTS.md): localStorage via `vi.spyOn(Storage.prototype, 'getItem')`, `provideHttpClientTesting` + `HttpTestingController`, `{ provide: PLATFORM_ID, useValue: 'browser' }` for Calendar, `vi.clearAllMocks()` in `beforeEach`.
- Acceptance: `npm test -- --watch=false` → `Tests N passed (N)` with 0 failures (exit code 1 due to the known NG04002 baseline is expected — see 3.8).

### 3.8 Verification + docs

- `npm run build` and `cd api && dotnet build` both pass.
- Smoke test with backend running (`cd api && dotnet run`, then `npm start`): create an event at `/events` → open the copy link in a new tab/profile as a guest → add a period as a different guest → reload, period persists; DELETE via right-click works; `/calendar/unknown` → error panel.
- Update `AGENTS.md`: endpoints section (new `/api/events*` endpoints, scoped periods), routing section (`/` → `/events`, public `/calendar/:eventId`), note that the calendar is now public and polls the event-scoped endpoint, and correct the NG04002 baseline count (removing `router.navigate` from Calendar's `ngOnInit` should lower it; record the new number).
- Acceptance: all commands pass; `git status` shows no unintended files.

## 4. Refactor and review

- Normalize the database schema (entities: `User`, `Event`, `Period` with proper relations/unique constraints; no duplicated data, consistent naming).
- Check the Docker files: `Dockerfile`, `api/Dockerfile`, `docker-compose.yml` — correct build, ports, volumes for the SQLite file, `API_URL` wiring.
- Review all code in the app (frontend and backend): remove dead code (e.g. hardcoded login leftovers, net9.0 build artifacts in `api/bin`), fix inconsistencies, clean up naming, keep Polish locale for all UI text.
- Run `npm test -- --watch=false` and the backend after changes to confirm nothing is broken.
