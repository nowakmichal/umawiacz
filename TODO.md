# TODO

> **For the coding agent:** Work through tasks in order, subtasks top to bottom.
> **STOP and ask the user for approval before starting each next subtask.** After finishing a subtask, show what changed (files touched + how it was verified) and wait for a "yes/continue" before moving on.
> After all subtasks of a task are done, run the task's verification command, then commit everything with the given message (one commit per task). Do not commit earlier.

## 1. Remove period (range) selection — day-by-day only

Today days can be marked two ways: "Zakres" mode (two taps or a swipe create one multi-day period with `start != end`) and "Dzień" mode (one tap = one-day period). Keep only day-by-day selection: every marking is a single-day period (`start == end`) created by clicking a day.

Goal: no multi-day marking left — one click on a day creates a one-day period for exactly that day; the mode toggle, the two-tap flow and the range swipe are gone.

- [x] **1.1 Remove the mode toggle** — delete the `SelectionMode` type, `selectionMode` signal and `setSelectionMode` from `src/app/calendar/calendar.ts`, and the `.mode-toggle` block ("Zakres" / "Dzień") from `calendar.html`. Remove the `.mode-btn`/`.mode-toggle` styles from `calendar.scss` (including the `min-height: 44px` entries in the ≤600px block). The toolbar keeps only the swatches and the ✕ erase button (the erase button goes in task 2).
  - Verify: `npm run build` passes; 390px viewport — toolbar shows only swatches + erase, no third row.
- [x] **1.2 Day-by-day click only** — `onDayClick` always takes the one-day path (`confirmSelection(day.date, day.date)`); delete the two-tap `selectionStart` branch. Remove the range-swipe confirmation paths in `onGridTouchEnd`/`onGridMouseUp` (the `confirmSelection(anchor, hover)` calls with different dates) and the anchoring in `onDayTouchStart`/`onDayMouseDown`; remove the grid-level `touchmove`/`mousemove`/`mouseup`/`touchcancel` handlers and their bindings in `calendar.html` (task 3 will bring back a new day-by-day swipe). Remove the now-dead range state and UI: `selectionStart`, `hoverDate`, `cancelSelection`, `isSelectionStart`, the "Wybierz datę końcową" hint, the "Anuluj" button, the `.selecting`/`.selection-start` classes on the grid/cells, and the swipe/press private fields (`swipeAnchor`, `pressAnchor`, ...). Keep the `.toolbar-row2` reserved mobile row — the erase hint ("Kliknij swój dzień, aby usunąć") still lives there until task 2.
  - Verify: `npm run build` passes; 390px — one tap creates a period with `start == end` for exactly the tapped day; tapping another day creates another one-day period; nothing in the UI can produce a multi-day period.
- [x] **1.3 Tests** — in `calendar.spec.ts`: remove the two-tap range tests ('selection flow' two-click cases), the mode-switching tests ('single-day mode' toggle tests) and the 'swipe range selection' describe; fold the 'single-day mode' one-tap tests into the default flow (one click → `createPeriod` with `start === end === that day`); adapt the 409 and local-fallback tests to a single tap.
  - Verify: `npm test -- --watch=false` fully green.

**Task verification:** `npm test -- --watch=false` green (exit 0) + `npm run build` passes + manual 390px pass: no mode toggle in the toolbar; every tap marks exactly the tapped day; no multi-day periods can be created.
**Commit:** `remove period selection from the calendar, keep day-by-day only`

## 2. Deselect by clicking a marked day; recolor on click

Today unmarking a day requires the ✕ erase button — a separate mode (`isErasing`, `toggleEraseMode`, "Kliknij swój dzień, aby usunąć" hint). Replace it with a plain toggle: a day is unselected the same way it is selected, by clicking it.

Goal:
- no erase button or erase mode at all;
- click an unmarked day → mark it with the selected color;
- click a day the current user marked with the **same** color as selected → unmark it;
- click a day the current user marked with a **different** color → change that marking to the currently selected color.

- [x] **2.1 Remove the erase mode** — delete `isErasing`/`toggleEraseMode` from `calendar.ts`, the `.erase-btn` from `calendar.html` and the `.erase-btn` styles from `calendar.scss` (44px ≤600px entry and the touch-action list). Remove the erase branches in `onDayClick`/`onDayTouchStart`/`onDayMouseDown` and the "Kliknij swój dzień, aby usunąć" hint. `.toolbar-row2` is now empty — remove it and drop the reserved `min-height: calc(44px + 6px + 44px)` on `.color-toolbar` in the ≤600px block, so the toolbar is a single stable row again.
  - Verify: `npm run build` passes; no ✕ button in the toolbar at 390px or desktop; toolbar height does not change when the color selection changes.
- [x] **2.2 Toggle + recolor on click** — in `onDayClick(day)`: look up the current user's own marking covering the day (normalized trim + lowercase username, same rule as `DayMarking.own`). If the user has no marking there → create a one-day period with `selectedColor()`. If the user's marking has the **same** color as `selectedColor()` → `removeMarking(periodId)` (unselect). If the user's marking has a **different** color → delete the user's covering period, then create a new one-day period for that day with the new color (delete first, then create, so the server's per-user overlap check cannot 409). Note: if the user's covering marking is a legacy multi-day period (old range data), deleting it removes the whole period — acceptable for old data. A day marked only by other users is treated as "unmarked" for the current user (creates the user's own marking alongside theirs).
  - Verify: 390px — click a free day (it is marked); click it again with the same color selected (it is unmarked); mark a day green, switch the selected color to red, click the day (it is now red).
- [x] **2.3 Tests** — in `calendar.spec.ts`: remove the 'erase mode' describe, the erase-related color-selection tests and the "removes the own marking on tap while erasing" touch test; add: (a) first click on a day creates a one-day period, second click on the same day with the same color calls `deletePeriod` for that period; (b) clicking a green own day while red is selected deletes the green period and creates a red one-day period; (c) clicking a day marked only by another user creates the current user's marking without deleting anything.
  - Verify: `npm test -- --watch=false` fully green.

**Task verification:** `npm test -- --watch=false` green + `npm run build` passes + manual 390px pass: one click selects, another click on the same day deselects; changing the selected color and then clicking a marked day recolors it; no ✕ button anywhere in the toolbar.
**Commit:** `unselect calendar days by clicking them and recolor on click`

## 3. Select days by click and swipe

Goal: pressing on a day and dragging (touch or mouse) paints the days under the pointer — every day the pointer passes over gets selected as its own one-day period. A press released without moving is a plain tap (task 2 toggle/recolor behavior).

- [x] **3.1 Swipe state + live preview** — reintroduce the swipe/press gesture state in `calendar.ts` (touch: `swipeAnchor`, `swipeMoved`, `SWIPE_THRESHOLD_PX`; mouse: `pressAnchor`, `pressMoved`) and the grid-level `touchstart`/`touchmove`/`touchend`/`touchcancel`/`mousedown`/`mousemove`/`mouseup` bindings in `calendar.html`, but instead of an anchor + hover range, track the set of day cells the pointer passes over (e.g. a `previewDays` signal keyed by ISO date). Each entered cell the current user does **not** already mark is added to the preview and highlighted cell-by-cell (reuse the `.selecting` class on `.day-cell`, re-add the needed SCSS). Below the jitter threshold the gesture is still a tap.
  - Verify: `npm run build` passes; 390px — while dragging, the passed cells light up one by one; cells the user already marked do not.
- [x] **3.2 Commit the swipe** — on `touchend`/`mouseup` after a real swipe (movement past the threshold): for each preview day create a one-day period (`start == end == that day`, `selectedColor()`, current user) — one `createPeriod` call per day, skipping days the user already marks (swipe only paints; it never unmarks or recolors). Reset all swipe/preview state afterwards.
  - Verify: 390px touch — press on day A, drag through A..B and release: one one-day period is created per passed day that was not already marked; days already marked by the user are untouched.
- [x] **3.3 Tap vs swipe** — a press released without moving past the threshold falls through to the normal `onDayClick` (task 2 toggle/recolor); a real swipe must not also fire the tap handler (swallow the synthetic click the same way the old range swipe did). The long-press tooltip on marked days keeps working as before.
  - Verify: 390px — a plain tap still toggles a single day; a swipe creates multiple one-day periods and the pressed day is not processed twice.
- [x] **3.4 Tests** — in `calendar.spec.ts` (replace the old swipe tests removed in task 1): (a) touch swipe from A to B (mocked `elementFromPoint` returning the intermediate day cells) → `createPeriod` called with `start === end` for each passed day; (b) days the user already marks are skipped (no create and no delete calls for them); (c) a touch that moves less than `SWIPE_THRESHOLD_PX` triggers no `createPeriod` and is treated as a tap; (d) mouse swipe behaves the same way.
  - Verify: `npm test -- --watch=false` fully green.

**Task verification:** `npm test -- --watch=false` green + `npm run build` passes + manual 390px pass: press-and-drag across a row of days selects every passed day one by one; a plain tap still toggles a single day.
**Commit:** `select calendar days by click and swipe`
