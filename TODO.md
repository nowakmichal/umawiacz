# TODO

> **For the coding agent:** Work through tasks in order, subtasks top to bottom.
> **STOP and ask the user for approval before starting each next subtask.** After finishing a subtask, show what changed (files touched + how it was verified) and wait for a "yes/continue" before moving on.
> After all subtasks of a task are done, run the task's verification command, then commit everything with the given message (one commit per task). Do not commit earlier.

## 1. Fix: mobile selection hint pushes the calendar down

On mobile (≤600px), when a selection starts, `.toolbar-hint` ("Wybierz datę końcową") and `.cancel-btn` appear inside `.color-toolbar` (`calendar.html` lines 91–94). At ≤600px both have 44px min-height and the toolbar `flex-wrap`s, so they wrap onto a second row — the toolbar grows by ~50px and the whole `.cal-grid` shifts down mid-gesture. The finger now lands on a different day than intended, making it hard to pick days. The erase hint has the same effect.

Goal: the grid top edge must not move when the hint/cancel buttons appear or disappear.

- [x] **1.1 Reserve the second toolbar row on mobile** — in the 600px block of `src/app/calendar/calendar.scss`, give `.color-toolbar` a stable height across all three states (idle / selecting / erasing): reserve space for a second row (e.g. `min-height: calc(44px + 6px + 44px)` to match the gap, or an explicit two-row layout where row 2 is always present and holds the hint/cancel). The toolbar height in idle state must already equal its height while selecting, so nothing shifts when `.toolbar-hint`/`.cancel-btn` toggle. Desktop (no media query) layout unchanged.
  - Verify: 360px viewport — toolbar occupies the same height before, during and after a selection.
- [x] **1.2 Hint/cancel always in the reserved row** — make sure the hint + cancel (and the erase hint) sit in the reserved second row rather than sharing row 1 with the swatches, so at 360/390px the swatches + erase always stay on row 1. If content can wrap to a third row at 360px, adjust paddings/font sizes in the 380px block so it never does.
  - Verify: 360px viewport — swatches + erase on one row, hint/cancel on the second row, no third row, no horizontal overflow.

**Task verification:** `npm test -- --watch=false` green (exit 0) + `npm run build` passes + manual 360/390px pass: start a selection, confirm it, cancel it, toggle erase — the top edge of `.cal-grid` does not move and day taps land where the finger is.
**Commit:** `fix mobile calendar shifting down when the selection hint appears`

## 2. Single-day selection mode

Today the only way to mark days is a range: first tap anchors `selectionStart`, second tap (or swipe) confirms `lo..hi` (`calendar.ts` `onDayClick`/`confirmSelection`). Marking a single day requires tapping the same small cell twice, which is awkward on a phone.

Goal: a "Dzień" mode next to the range flow — one tap on a day immediately creates a one-day period (`start == end`).

- [x] **2.1 Mode state + toolbar toggle** — add `selectionMode` signal (`'range' | 'single'`, default `'range'`) in `src/app/calendar/calendar.ts` and a two-button toggle in `.color-toolbar` (`calendar.html`, near the swatches: "Zakres" / "Dzień", active state styled like `.color-swatch.active`). Switching mode clears `selectionStart`/`hoverDate` (and cancels any armed swipe/press). Keep 44px touch targets at ≤600px.
  - Verify: `npm run build` passes; 390px viewport — toggle fits without wrapping to a third row (works with task 1's reserved-row layout).
- [x] **2.2 Single-day flow** — in `onDayClick`: when `selectionMode() === 'single'`, a tap with no `selectionStart` calls `confirmSelection(day.date)` directly (one-day period, `start == end`), so no second tap is needed. Disable range gestures in single mode: `onDayTouchStart` must not arm the long-press-free swipe anchor, `onDayMouseDown` must not arm the mouse press, and grid-level `touchmove`/`mousemove` no-ops while in single mode (a tap is a tap). The existing 409 error and local-fallback paths in `confirmSelection` work unchanged.
  - Verify: 390px touch emulation — in "Dzień" mode one tap on a day creates a period for exactly that day (network request `start == end`); tapping again with the same day gives the usual 409 message.
- [x] **2.3 Range mode untouched** — two-tap and swipe flows behave exactly as before in "Zakres" mode; the "Wybierz datę końcową" hint only shows in range mode.
  - Verify: 390px touch emulation — two-tap a range and swipe a range in "Zakres" mode → same periods as before.
- [x] **2.4 Tests** — in `calendar.spec.ts`: (a) single mode: one click on a day → `createPeriod` called with `start === end === that day`; (b) switching mode clears `selectionStart`; (c) single mode does not start a swipe/press on touch/mouse down; (d) existing range two-tap and swipe tests stay green.
  - Verify: `npm test -- --watch=false` fully green.

**Task verification:** `npm test -- --watch=false` green + `npm run build` passes + manual 390px pass: "Dzień" mode marks one day per tap; "Zakres" mode two-tap and swipe unchanged.
**Commit:** `add single-day selection mode to the calendar`

## 3. Make own markings distinct from other users' markings

Today a day shows one `.period-band` per user who marked it (split evenly, differing only by color) plus a faint whole-cell tint for the current user's own days (`tint-free`/`tint-busy`). With multiple users, it is hard to tell at a glance which days are already yours.

Goal: the current user's own band on a day is visually obvious, so they can see which days are already selected by them.

- [x] **3.1 Flag own markings** — in the `weeks()` computed (`src/app/calendar/calendar.ts`), mark each `DayMarking` as `own: boolean` (normalized userName === current user, same normalization already used for `ownColor`). Extend the `DayMarking` interface.
  - Verify: `npm test -- --watch=false` green (update `weeks grid` / `own marking tint` expectations if they assert on the interface).
- [x] **3.2 Style the own band** — in `calendar.html` bind `[class.own]="m.own"` on `.period-band`; in `calendar.scss` give `.period-band.own` a clear outline (e.g. `box-shadow: 0 0 0 1.5px rgba(17, 24, 39, 0.85)`) and make it slightly taller than the other bands (e.g. 7px vs 6px on desktop, 6px vs 5px at ≤600px) so it stands out even against a same-colored neighbor band. Keep the existing cell tint as-is.
  - Verify: 390px viewport, day marked by you and another user → your band is outlined and taller, the other's is plain.
- [x] **3.3 Tests** — in `calendar.spec.ts`: a day with own + other user's markings → own band has `.own`, the other's does not; with no current user → no band has `.own`; existing `own marking tint` tests stay green.
  - Verify: `npm test -- --watch=false` fully green.

**Task verification:** `npm test -- --watch=false` green + `npm run build` passes + manual 390px pass: on a day shared with another user, your own marking is instantly recognizable.
**Commit:** `make own calendar markings stand out from other users'`
