# TODO

> **For the coding agent:** Work through tasks in order, subtasks top to bottom.
> **STOP and ask the user for approval before starting each next subtask.** After finishing a subtask, show what changed (files touched + how it was verified) and wait for a "yes/continue" before moving on.
> After all subtasks of a task are done, run the task's verification command, then commit everything with the given message (one commit per task). Do not commit earlier.

## 1. Make the app more mobile friendly

Builds on the earlier mobile pass (breakpoints, 44px targets). Target widths: 360px, 390px. No horizontal scroll, no iOS input auto-zoom, notch-safe.

- [x] **1.1 No iOS input auto-zoom** — iOS Safari zooms the page when focusing an input with font-size < 16px. In `src/app/events/events.scss` (~line 190) `.form-group input` is `0.95rem` (≈15.2px) → `1rem` (16px). Audit the other inputs (login `.form-control` and calendar `.modal-input` are already `1rem` — just confirm nothing else is < 16px).
  - Verify: dev server, 390px viewport (or iOS Safari) — focusing the events form inputs does not zoom the page.
- [x] **1.2 Safe-area (notch/home-indicator) support** — in `src/index.html` add `viewport-fit=cover` to the viewport meta. Then pad the page shells by `env(safe-area-inset-*)`: `src/app/calendar/calendar.scss` `.calendar-shell` and `src/app/events/events.scss` `.events-shell` (e.g. `padding: calc(24px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) ...` — fold into the existing mobile-breakpoint paddings so they don't double up).
  - Verify: `npm run build` passes; DevTools device emulation with notch — content clears the notch and home indicator.
- [x] **1.3 Calendar top bar on mobile** — `src/app/calendar/calendar.html` `.cal-topbar` at ≤600px currently wraps "Moje wydarzenia" + user-chip + Wyloguj + Kopiuj link into an awkward 2-row mess (the chip/buttons force 44px min-heights). Restructure the ≤600px layout (`calendar.scss` 600px block) into two clean rows: row 1 = `topbar-link` as a full-width back row (`← Moje wydarzenia`, 44px hit area, left-aligned), row 2 = user-chip + Wyloguj + Kopiuj link right-aligned. No desktop layout change; no behavior change.
  - Verify: 360px viewport — top bar fits in 2 tidy rows, nothing clips or wraps mid-row, all controls tappable.
- [x] **1.4 Touch target audit (round 2)** — remaining sub-44px targets: `src/app/events/events.scss` `.primary-btn` / `.copy-btn` (≈36px tall, smaller still in the 380px block) → `min-height: 44px` with vertically centered content at ≤600px; `.link-btn` inside the events error banner ("Spróbuj ponownie") → transparent padding to a 44px hit area. Re-check the calendar 600px block still covers `.today-btn`, `.cancel-btn`, `.copy-link-btn`, `.logout-btn`, `.topbar-link`.
  - Verify: 390px viewport pass — no interactive element < 44px tall.
- [x] **1.5 Dismissible calendar error banner** — the 409/network `error-banner` (`calendar.html` line 95) has no way to dismiss it; the `.error-close` style already exists unused in `calendar.scss` (line 425). Add a `✕` button wired to a new `clearError()` in `calendar.ts` (`errorMessage.set(null)`).
  - Verify: `npm test -- --watch=false` green (extend the existing `error banner` describe block in `calendar.spec.ts`).

**Task verification:** `npm test -- --watch=false` green (exit 0) + `npm run build` passes + manual 360/390px pass on events, calendar, and login (no overflow-x, no zoom on focus, tidy top bar).
**Commit:** `improve mobile UX: no input auto-zoom, safe-area insets, top bar layout, touch targets, dismissible error banner`

## 2. Fix: selecting days that another user has already marked

Today, on touch devices, `onDayTouchStart` (`src/app/calendar/calendar.ts` lines 267–285) shows the tooltip and swallows the click whenever `day.markings.length > 0` — so on a phone you cannot start or confirm a range on a day another user marked, even though the backend accepts it (overlap is rejected 409 only per-user, within one event). Desktop mouse click already works.

Desired: on touch, tapping a day marked by another user behaves exactly like an unmarked day — it starts/confirms the range selection. The tooltip (who marked this day) stays reachable on touch via **long-press (~450ms)** on a marked day.

- [ ] **2.1 Stop swallowing taps on marked days** — in `onDayTouchStart`, remove the branch (lines ~281–284) that positions the tooltip + sets `pendingClickSwallow` on a plain touch of a marked day; a touch now falls through to the normal synthetic click → `onDayClick` starts/confirms the selection on any day. Keep unchanged: the early returns for `isErasing()`/`selectionStart()` and the "tooltip open → dismiss + swallow" branch.
  - Verify: `npm test -- --watch=false` green (the spec test `shows the tooltip on a marked day and swallows the following click` at `calendar.spec.ts` ~line 489 encodes the old behavior — update it, see 2.3).
- [ ] **2.2 Long-press tooltip on touch** — add a long-press timer (~450ms): on touchstart of a marked day (not erasing, not mid-selection, no open tooltip) start the timer; on fire → `positionTooltip(...)` and set `pendingClickSwallow` so the follow-up click is swallowed. Cancel the timer on `touchend`/`touchmove`/`touchcancel` before it fires. Bind the cancel/end handlers at `.cal-grid` level in `calendar.html` (grid-level `(touchend)` / `(touchmove)` / `(touchcancel)` on the existing div, or a small new handler on each cell — grid level is preferred since the finger may leave the starting cell).
  - Verify: 390px touch emulation — long-press a marked day → tooltip with the marking user(s) appears; quick tap on the same day → selection starts instead.
- [ ] **2.3 Tests** — in `calendar.spec.ts` (`touch flow` describe): replace the old "tooltip on tap" test with (a) touchstart+click on a day marked only by **another** user → `selectionStart()` set (selection can start on it), (b) two taps on marked days → `createPeriod` called with the range (confirm works on marked days too), (c) long-press (fire the timer, e.g. `vi.useFakeTimers()` or extract the delay) on a marked day → `tooltipDay()` set and the subsequent click swallowed. Keep the "dismiss open tooltip on tap elsewhere" and "skips tooltip while selecting" tests green.
  - Verify: `npm test -- --watch=false` fully green.

**Task verification:** `npm test -- --watch=false` green + manual phone/390px-touch pass: start and end a range on days marked by another user → period created; long-press still shows who marked a day.
**Commit:** `allow selecting days marked by other users on touch; move tooltip to long-press`

## 3. Select days by swipe (drag range selection)

Goal: press a day, drag across the grid, release → period created from anchor day to release day. Works with touch (primary) and mouse (desktop: press-drag-release, in addition to the existing two-click flow).

- [ ] **3.1 Extract `confirmSelection(end: Date)`** — pull the second-tap body of `onDayClick` (`calendar.ts` lines ~302–360: lo/hi, `createPeriod` call, 409 → error message, network-failure local fallback, state cleanup) into a private method; `onDayClick` calls it. Behavior identical.
  - Verify: `npm test -- --watch=false` green with no behavior change.
- [ ] **3.2 Touch swipe** — add swipe state: anchor `Date`, start touch coords, `moved` flag. In `onDayTouchStart` record anchor/coords (do not set `selectionStart` yet). Add grid-level `(touchmove)`/`(touchend)`/`(touchcancel)` in `calendar.html`: on move, once the finger is > ~10px from the start point set `selectionStart(anchor)` and `moved = true`, then resolve the day under the finger with `document.elementFromPoint(x, y)?.closest('.day-cell')` (add a `data-date` ISO attribute to `.day-cell` in `calendar.html`) and set `hoverDate` (the existing `weeks()` computed already renders the range preview). On `touchend`: if `moved` → `confirmSelection(hoverDate ?? anchor)` and clear swipe state; otherwise leave the gesture to the normal tap → `onDayClick` path. Call `event.preventDefault()` in `touchmove` while swiping so the page doesn't scroll.
  - Verify: 390px touch emulation — swipe across 3+ days → period created from first to last touched day; a plain tap still uses the two-tap flow.
- [ ] **3.3 Mouse swipe** — `mousedown` on a day: if no `selectionStart`, set it; record press coords + `pressing = true`. Grid-level `mousemove`: while pressing and past the ~10px threshold, update `hoverDate` via `elementFromPoint` (mouse hover/`onDayMouseEnter` already covers cell entry — keep both, last-write-wins). `mouseup`: if `pressing` and moved → `confirmSelection(hoverDate ?? anchor)` and set a swallow flag so the follow-up click doesn't fire the two-click path again; if no movement, clear press state and let the normal click flow handle it (two-click flow must keep working). Also cancel the press on `mouseleave`/`touchstart` so a stale press never confirms later.
  - Verify: desktop — press day 1, drag to day 5, release → period 1–5 created; single click-click flow unchanged.
- [ ] **3.4 `touch-action` / scroll interplay** — `.day-cell` currently has `touch-action: manipulation` (`calendar.scss` line ~617) and `.cal-grid.selecting .day-cell` has `none` (line ~624). Ensure: vertical page scroll still works when the user is not swiping; horizontal drag over the grid becomes a selection (switch the grid to `touch-action: pan-y` if `preventDefault` in the template-bound `touchmove` is not honored — Angular element-level touch listeners are non-passive, so `preventDefault` should work; verify on a real device/emulation). Keep the existing `.selecting` rule only if still needed.
  - Verify: on a phone the calendar page still scrolls vertically from the grid; an active swipe does not scroll the page.
- [ ] **3.5 Tests** — in `calendar.spec.ts`: touch swipe (touchstart on day A, `touchmove` events past the threshold toward day B — stub `document.elementFromPoint` to return the target cell, `touchend`) → `createPeriod` called with A..B; mouse swipe (mousedown A, mousemove past threshold to B, mouseup) → created; non-moving touch and click flows unchanged (existing two-tap / two-click tests stay green). Guard `document.elementFromPoint` usage so tests/SSR don't touch the real DOM.
  - Verify: `npm test -- --watch=false` fully green.

**Task verification:** `npm test -- --watch=false` green + `npm run build` passes + manual pass: swipe a range on 390px touch emulation, drag a range on desktop, confirm two-tap/two-click still work and page scroll isn't hijacked.
**Commit:** `add swipe/drag range selection to the calendar`
