# TODO

> **For the coding agent:** Work through tasks in order, subtasks top to bottom.
> **STOP and ask the user for approval before starting each next subtask.** After finishing a subtask, show what changed (files touched + how it was verified) and wait for a "yes/continue" before moving on.
> After all subtasks of a task are done, run the task's verification command, then commit everything with the given message (one commit per task). Do not commit earlier.

## Done

- ~~Remove period (range) selection — day-by-day only~~ — commit `remove period selection from the calendar, keep day-by-day only`
- ~~Deselect by clicking a marked day; recolor on click~~ — commit `unselect calendar days by clicking them and recolor on click`
- ~~Select days by click and swipe~~ — commit `select calendar days by click and swipe`
- ~~Marking overwrites smoothly — no errors, paint with the selected color~~ — commit `make calendar marking overwrite existing days instead of erroring`
- ~~Instant marking — optimistic updates (fix slow drag)~~ — commit `apply calendar markings optimistically for instant feedback`

## 3. Mobile marking broken on Android/Firefox over plain HTTP

**Symptom:** after the task 2 changes, marking works on PC (mouse, `localhost`) but does nothing on the phone (Android, Firefox) — taps and swipes alike.

**Root cause (confirmed in code):** `paintDay` now calls `crypto.randomUUID()` synchronously on the marking path — in `createOneDayMarking` and in the recolor branch. `randomUUID()` is **secure-context only** (HTTPS or `localhost`). The phone reaches the app over plain `http://<LAN-IP>:4200` (`npm run start:local`, 0.0.0.0 binding) → not a secure context → `crypto.randomUUID` is `undefined` → every tap/swipe throws `TypeError: crypto.randomUUID is not a function` inside `onDayClick`/`commitPreviewDays`, and Angular's event handling swallows the error, so the UI just does nothing. PC works because `localhost` is a secure context. Unmarking (toggle-off) is unaffected — it never calls `randomUUID`.

**Target:** marking (create + recolor, tap and swipe) works over plain HTTP; the temp id falls back to a non-crypto generator when `crypto.randomUUID` is unavailable. No backend changes. (Note: `touch-action: pan-y` on `.cal-grid` is an intentional design — vertical swipe scrolls the page, horizontal swipes/taps mark. If vertical-swipe marking on the phone is also wanted, that's a separate gesture redesign, out of scope here.)

- [x] **3.1 Temp id with a non-secure-context fallback** — add a module-level `newTempId()` helper in `calendar.ts`: use `crypto.randomUUID()` when it exists, otherwise return a `Date.now()` + `Math.random()`-based string (the id only needs to be unique within the local `periods()` list; crypto strength is not required). Use it at both call sites (create + recolor).
  - Verify: `npx ng test --include="src/app/calendar/calendar.spec.ts"` green + `npm run build` exit 0.
- [x] **3.2 Regression test: marking works without `crypto.randomUUID`** — unit tests simulating a non-secure context (stub the global `crypto` without `randomUUID`, restore afterwards): tapping an unmarked day doesn't throw, an optimistic entry with the fallback id lands in `periods()` before any response is flushed, the create request is issued, and the server response replaces the temp entry by id; same for the swipe path (`commitPreviewDays` paints the whole preview range).
  - Verify: new tests pass; `npm test -- --watch=false` fully green (exit 0).
- [x] **3.3 On-device verification** — `npm run start:local`, open the event calendar from the phone (Android, Firefox) over plain HTTP via the LAN IP: a tap marks instantly, a horizontal swipe marks multiple days, recolor and unmarking (toggle-off) work, no console errors. Re-check desktop (`localhost`) is unaffected.
  - Verify: manual pass on the phone + desktop regression.

**Task verification:** `npm test -- --watch=false` green (exit 0) + `npm run build` exit 0 + on-device pass (3.3).
**Commit:** `fix calendar marking on phones over plain http`
