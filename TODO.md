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

## 2. Username display on the calendar page: move higher + bigger font

Today: the current username is shown as a small pill (`.user-chip`, 0.78rem) in `header-meta` — mid month-nav row, below the month label, squeezed between the `Dziś` and `Wyloguj` buttons (`src/app/calendar/calendar.html`). Goal: show it **higher** on the page with a **bigger font**. **Login functionality stays exactly as-is** — the `/login` page, `authGuard`, `AuthService`, `LoginService` and the calendar's guest-name modal are all unchanged.

- [x] **2.1 Move username display up** — in `src/app/calendar/calendar.html` move the `user-chip` + `Wyloguj` button (the `@if (currentUser())` block) out of `header-meta` and place it higher on the page: in `event-header`, next to the event name. Behavior unchanged (`logout()` call as-is, same `@if` condition).
  - Verify: `npm test -- --watch=false` green (update `calendar.spec.ts` selectors only where the DOM move legitimately breaks them).
- [x] **2.2 Bigger font** — in `src/app/calendar/calendar.scss`: `.user-chip` font-size ≥ 18px (tune padding/border-radius so the pill still looks right), `Wyloguj` button text ≥ 16px.
  - Verify: visual check on desktop — username clearly larger than before (baseline 0.78rem ≈ 12.5px) and positioned higher on the page.

**Task verification:** `npm test -- --watch=false` green + `npm run build` passes.
**Commit:** `move username display higher on calendar page, enlarge its font`

## 3. Mobile support

Viewport meta already exists in `src/index.html` — no change needed. Target widths: 360px, 390px, then up; no horizontal scroll anywhere.

- [x] **3.1 Audit + extend breakpoints** — review the existing responsive blocks: the 600px one in `src/app/events/events.scss` (~line 209) and the 600px + 380px ones in `src/app/calendar/calendar.scss` (~lines 551, 614). Extend them so at 360px: no horizontal scroll, nothing clipped, paddings tightened.
  - Verify: dev server at 360px viewport — events + calendar pages, no `overflow-x`.
- [x] **3.2 Calendar touch flow** — color toolbar (`.color-toolbar` in `calendar.html`) must wrap/stack on narrow screens; day cells stay tappable; verify tap-selection works without hover (touch fires the normal click flow) and the tooltip touch fallback (show on tap, hide on tap elsewhere — already implemented in `onDayTouchStart`) works.
  - Verify: tap-select range on a 390px viewport works end-to-end (start date → end date → period created).
- [x] **3.3 Events + login page responsiveness** — full-width action buttons (`copy-btn`/`primary-btn` stack vertically, each 100% wide); single-column `form-grid` (already at 600px — verify); login page (`login.html`, standalone route — there is no global header) usable at 360px without overflow.
  - Verify: dev server at 360px — create form usable, buttons full-width, header not overflowing.
- [x] **3.4 Touch targets** — ensure all interactive elements are ≥ 44px tall/wide (nav arrows, color swatches, erase button, buttons) and calendar day cells don't trigger page scroll while selecting (consider `touch-action: manipulation` / preventing default on the grid).
  - Verify: no element < 44px on mobile pass; day selection doesn't scroll the page.

**Task verification:** `npm test -- --watch=false` green + `npm run build` passes + manual 360px pass on events, calendar, and login. If architecture changed (new header component, route removal), update `AGENTS.md` routing section in the same task.
**Commit:** `mobile support: responsive layouts, touch targets, calendar touch flow`

## 4. Make calendar color marks more readable

Today: marks are thin 4px bands (3px on mobile) at the bottom of each day cell, one band per user; the `.has-markings` class is applied but unstyled; toolbar swatches have no visible label. Goal: at-a-glance readability. No data/API changes (colors stay `green`/`red`, storage unchanged).

- [ ] **4.1 Bolder bands** — in `src/app/calendar/calendar.scss`: `.period-band` height 4px → 6px (and 3px → 5px in the 600px block), `.markings-row` padding-bottom 3px → 5px. One band per user stays as-is.
  - Verify: `npm run build` passes; visual check — bands clearly visible at a glance.
- [ ] **4.2 Tint day cells by the viewer's own marking** — in `calendar.ts`: add `ownColor: SelectionColor | null` to `CalendarDay`, derived from the `currentUser()` marking on that day (at most one per user per day — server rejects overlaps); in `calendar.html`: `[class.tint-free]="day.ownColor === 'green'"`, `[class.tint-busy]="day.ownColor === 'red'"`; in `calendar.scss`: light tints (e.g. `#f0fdf4` / `#fef2f2`), keeping `.selecting`/`.selection-start` and `.today` visually dominant over the tint.
  - Verify: `npm test -- --watch=false` green (extend `calendar.spec.ts` for the new classes), `npm run build` passes; visual — the viewer's free/busy days are clearly tinted while other users' marks remain bands.
- [ ] **4.3 Visible color legend in the toolbar** — in `calendar.html` + `calendar.scss`: render each swatch with its visible label beside it (dot + `SELECTION_COLORS` label: Wolny/Zajęty); keep click-to-select, the `.active` state, and the erase button unchanged.
  - Verify: `npm test -- --watch=false` green, `npm run build` passes; visual — both colors labeled in the toolbar.

**Task verification:** `npm test -- --watch=false` green + `npm run build` passes + visual pass at desktop and 390px: own marks tinted, bands prominent, legend readable.
**Commit:** `make calendar color marks more readable: bolder bands, own-day tint, labeled legend`
