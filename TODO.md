# TODO

> **For the coding agent:** Work through tasks in order, subtasks top to bottom.
> **STOP and ask the user for approval before starting each next subtask.** After finishing a subtask, show what changed (files touched + how it was verified) and wait for a "yes/continue" before moving on.
> After all subtasks of a task are done, run the task's verification command, then commit everything with the given message (one commit per task). Do not commit earlier.

## 1. Remove orange color; rename red → "zajęty", green → "wolny"

Color **values** stay `green`/`red` (storage + API unchanged except validation); only the orange option and the Polish labels change.

- [x] **1.1 Frontend model** — in `src/app/models/period.model.ts`:
  - `SelectionColor` type: `'green' | 'red'` (remove `'orange'`).
  - `SELECTION_COLORS`: remove the orange entry; labels → green: `Wolny`, red: `Zajęty` (hex values unchanged).
  - Verify: `npx ng build` or `npm test` compiles (type error if anything still references `'orange'`).
- [x] **1.2 Backend validation** — in `api/Program.cs` (~line 134): accept only `"green" or "red"`; error message → `"Color must be 'green' or 'red'."`. Also fix the stale comment `// green | orange | red` in `api/Models/Period.cs`.
  - Verify: `cd api && dotnet build` succeeds.
- [x] **1.3 Tests** — in `src/app/calendar/calendar.spec.ts`: replace orange usages (fixture ~line 60, `selectColor('orange')` ~line 208) with `green`/`red`; fix any label assertions.
  - Verify: `npm test -- --watch=false` fully green.
- [x] **1.4 Legacy data** — check `api/umawiacz.db` for rows with `color = 'orange'` (e.g. `sqlite3 api/umawiacz.db "SELECT COUNT(*) FROM Periods WHERE Color='orange'"` or EF). If any exist, `UPDATE ... SET Color='red'`; if the DB is disposable dev data, deleting the file and letting `EnsureCreated()` rebuild it is acceptable.
  - Verify: zero `orange` rows remain.

**Task verification:** `npm test -- --watch=false` green (exit 0, `Tests N passed (N)`).
**Commit:** `remove orange color, rename labels to Wolny/Zajęty, restrict API to green|red`

## 2. Move login to the top of the app + bigger font

Today: `/login` is a standalone page; `authGuard` (`src/app/guards/auth.guard.ts`) redirects unauthenticated users there. Goal: an always-visible login bar at the top of the app on every route.

- [ ] **2.1 Header component** — create `src/app/header/header.ts|.html|.scss` (standalone, Angular style used in `src/app/`). Move the login logic out of `LoginComponent.onSubmit()` into the header: username input + `Zaloguj` button, calls `LoginService`, stores via `AuthService`, error message shown inline.
  - Verify: component compiles; unit spec `header.spec.ts` created and green.
- [ ] **2.2 Wire into app shell** — in `src/app/app.html` render `<app-header />` above `<router-outlet />`. When authenticated, the header shows the current username + `Wyloguj` button (uses `AuthService.currentUser` / `logout()`).
  - Verify: `npm test -- --watch=false` green; app still SSR-builds (`npm run build`).
- [ ] **2.3 Remove old login page** — delete `src/app/login/` (component, html, scss, spec) and the `login` route in `src/app/app.routes.ts`; change `authGuard` to redirect to `/events` (the header now handles the login UX). Update `login.service.ts` consumers if needed (it stays).
  - Verify: `npm test -- --watch=false` green, `npm run build` passes (AOT catches stale imports).
- [ ] **2.4 Bigger font** — in the header styles: username input font-size ≥ 18px, button ≥ 18px, label ≥ 16px (bump `login.scss` values accordingly when moving styles).
  - Verify: visual check on desktop — input/button text clearly larger than before (16px baseline).

**Task verification:** `npm test -- --watch=false` green + `npm run build` passes.
**Commit:** `move login to app header with larger font, drop /login page`

## 3. Mobile support

Viewport meta already exists in `src/index.html` — no change needed. Target widths: 360px, 390px, then up; no horizontal scroll anywhere.

- [ ] **3.1 Audit + extend breakpoints** — review the existing `@media (max-width: 600px)` blocks in `src/app/events/events.scss` (~line 209) and `src/app/calendar/calendar.scss` (~lines 551, 614). Extend them so at 360px: no horizontal scroll, nothing clipped, paddings tightened.
  - Verify: dev server at 360px viewport — events + calendar pages, no `overflow-x`.
- [ ] **3.2 Calendar touch flow** — color toolbar (`cal-toolbar` in `calendar.html`) must wrap/stack on narrow screens; day cells stay tappable; verify the existing `touchstart` selection works without hover and the tooltip (hover-only today) has a touch fallback (e.g. show on tap, hide on tap elsewhere).
  - Verify: tap-select range on a 390px viewport works end-to-end (start date → end date → period created).
- [ ] **3.3 Events + header responsiveness** — single-column `form-grid`, full-width action buttons (`copy-btn`/`primary-btn` stack), header login bar stacks cleanly (input + button wrap on <400px).
  - Verify: dev server at 360px — create form usable, buttons full-width, header not overflowing.
- [ ] **3.4 Touch targets** — ensure all interactive elements are ≥ 44px tall/wide (nav arrows, color swatches, erase button, buttons) and calendar day cells don't trigger page scroll while selecting (consider `touch-action: manipulation` / preventing default on the grid).
  - Verify: no element < 44px on mobile pass; day selection doesn't scroll the page.

**Task verification:** `npm test -- --watch=false` green + `npm run build` passes + manual 360px pass on events, calendar, and header login. If architecture changed (new header component, route removal), update `AGENTS.md` routing section in the same task.
**Commit:** `mobile support: responsive layouts, touch targets, calendar touch flow`
