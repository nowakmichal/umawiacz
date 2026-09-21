# TODO

> **For the coding agent:** Work through tasks in order, subtasks top to bottom.
> **STOP and ask the user for approval before starting each next subtask.** After finishing a subtask, show what changed (files touched + how it was verified) and wait for a "yes/continue" before moving on.
> After all subtasks of a task are done, run the task's verification command, then commit everything with the given message (one commit per task). Do not commit earlier.

## Done

- ~~Remove period (range) selection — day-by-day only~~ — commit `remove period selection from the calendar, keep day-by-day only`
- ~~Deselect by clicking a marked day; recolor on click~~ — commit `unselect calendar days by clicking them and recolor on click`
- ~~Select days by click and swipe~~ — commit `select calendar days by click and swipe`

## 1. Marking overwrites smoothly — no errors, paint with the selected color

**Today (root causes, all in `src/app/calendar/calendar.ts`):**

1. Recoloring click (own day marked with a **different** color): `onDayClick` starts `removeMarking()` (DELETE) and immediately calls `confirmSelection()` (POST). The POST can reach the server before the DELETE completes → the server's per-user overlap check → **409** → error banner `Zaznaczyłeś już jeden lub więcej dni w tym zakresie.` and the day is left unmarked locally. This is the reported "click a Zajęty day while Wolny is selected → error".
2. A swipe cannot repaint own days: `addPreviewDay` skips cells where `day.ownColor !== null`, so dragging over a day previously marked with the other color does nothing.
3. A swipe does not paint the pressed (anchor) cell — only cells entered during movement.

**Target behavior:**

- Click a day:
  - no own marking (or markings by other users only) → create a one-day period with the selected color (existing behavior, keep it);
  - own marking with the **same** color as selected → unmark it (delete the own period) (existing behavior, keep it);
  - own marking with a **different** color → change that marking to the selected color, smoothly — no error banner on success.
- Drag (touch or mouse): the pressed cell and every cell passed over is painted with the selected color — including cells with own markings (repainted) and cells marked by other users (the current user's band added alongside theirs). A cell that already has an own marking in the selected color costs no request. A swipe never unmarks.
- Other users' periods are never deleted or modified. No backend changes.

- [x] **1.1 Chain delete → create on recolor; silent resync on 409** — replace the delete-then-`confirmSelection` sequence in `onDayClick` with a single private `paintDay(day: CalendarDay, toggle: boolean)` helper (delete `confirmSelection`; its request/error logic moves into the create path of `paintDay`). Inside `paintDay`: no own marking → create a one-day period (`start == end == that day`, `selectedColor()`, current user). Own marking, same color → `toggle` ? delete the own period : return. Own marking, different color → subscribe to `deletePeriod(ownId)` and issue the create only inside the delete's `next` callback (chained order is what keeps the server's overlap check from 409-ing). On a **409** from the create: no error banner — resync instead (fetch `periodService.getPeriods(eventId)` and set `periods`); a 409 now only means the local list is stale (e.g. the same user marked in another tab between the 15s polls). On any other create error keep the current offline fallback (the period stays local, no banner). If the resync itself fails, show the existing error banner with the message `Nie udało się zsynchronizować kalendarza. Spróbuj ponownie.` The old 409 message string becomes unused — remove it.
  - Verify: unit tests — (a) clicking an own green day with red selected calls `deletePeriod`, and `createPeriod` is **not** called until the delete observable emits (use a deferred/subject-backed mock), then after the delete emits it is called with the one-day red request; (b) a 409 on the create calls `getPeriods` for a resync and leaves `errorMessage()` null.
- [ ] **1.2 Swipe paints every cell, including own-marked ones and the anchor** — (a) in `onGridTouchStart`/`onGridMouseDown`, add the anchor cell's date to `previewDays` up front (instead of just resetting it to `[]`), so a swipe also paints the pressed day; (b) in `addPreviewDay`, drop the `day.ownColor !== null` guard — every cell can be previewed; (c) `commitPreviewDays` calls `paintDay(day, false)` for each previewed day (look the `CalendarDay` up from `weeks()` as today), so: unmarked → create; own different color → delete→create; own same color → no request.
  - Verify: unit tests — a mouse drag and a touch swipe that start on an own-marked day repaint it (delete + one-day create with the new color); a swipe over a day with an own marking in the selected color issues no request for that day; the anchor day is painted as part of the swipe.

**Task verification:** `npm test -- --watch=false` green (exit 0) + `npm run build` passes + manual pass (desktop and 390px): click a red day with green selected → it turns green, no error banner; click a green day with green selected → it is unmarked; drag across a mix of unmarked, own-red and other-user-marked days with green selected → every passed cell ends up green for the current user, no error banner anywhere.
**Commit:** `make calendar marking overwrite existing days instead of erroring`

## 2. Instant marking — optimistic updates (fix slow drag)

**Today (root cause):** after release, `commitPreviewDays` fires N independent `createPeriod` POSTs (plus DELETE + POST for each repainted day), and each cell only gets its final color when **its own** HTTP response arrives. The `.selecting` preview highlight is cleared immediately in `onGridMouseUp`/`onGridTouchEnd`, so the grid visibly empties and then refills one cell at a time — the last cell waits for the last round-trip. That is the reported "zaznaczając kilka pól upływa zauważalnie dużo czasu aż ostatnie pole się zaznaczy".

**Target:** the grid updates **synchronously on commit** — every painted cell shows the selected color the moment the pointer is released, with no waiting for the server. Server responses only reconcile ids; failures fall back to a resync. No backend changes. (Known accepted limitation: a 15s poll landing while an optimistic request is in flight can briefly overwrite it — do not redesign the polling in this task.)

- [ ] **2.1 Optimistic create** — in the create path of `paintDay`, before issuing the POST, immediately push a temporary period `{ id: crypto.randomUUID(), eventId, start, end, color, userName }` into `periods()`; on the POST `next`, replace the temp entry (matched by temp id) with the server response; on a **409** remove the temp and resync (silent, per 1.1); on any other error keep the temp (offline fallback — same user-visible outcome as today's local fallback).
  - Verify: unit test — with a deferred (not-yet-emitted) create mock, right after `onDayClick` the new period is already present in `periods()`; emitting the response replaces the temp id with the server id.
- [ ] **2.2 Optimistic recolor + delete** — in the different-color path of `paintDay`, before issuing the delete, replace the own period in `periods()` with a temp one-day period of the new color (the cell repaints instantly); on the create `next` replace the temp with the server id; on any failure resync from the server. The same-color toggle-off keeps its current behavior (own period removed from `periods()` immediately, on both success and error).
  - Verify: unit test — after a recolor click, `periods()` no longer contains the old period and contains a one-day period of the new color, all before any HTTP response is flushed.
- [ ] **2.3 No gap between preview and paint** — with 2.1/2.2 the optimistic updates are applied synchronously inside `commitPreviewDays`, i.e. before `previewDays.set([])` runs in `onGridMouseUp`/`onGridTouchEnd`, so the `tint-free`/`tint-busy` classes take over the `.selecting` highlight in the same change-detection cycle (no flash to empty). Keep that order (paint first, clear preview after).
  - Verify: unit test — with deferred create mocks, immediately after `touchend`/`mouseup` the affected day cells carry `tint-free` or `tint-busy` and `previewDays()` is empty.
- [ ] **2.4 Update click/swipe test expectations to the new semantics** — in `calendar.spec.ts`: swipes now paint the anchor day and repaint own-marked days, so rewrite `'skips days the current user already marked and marks the rest of the swipe path'` as "repaints days the current user already marked"; update the two "marks each day a … swipe passes over" tests for the extra anchor-day create; rewrite `'should show error on 409 conflict'` as "resyncs silently on 409" and `'should add period locally on network error (fallback)'` as "keeps the optimistic period on network error"; keep the tap-vs-swipe threshold tests green.
  - Verify: `npm test -- --watch=false` fully green (exit 0, all tests pass).

**Task verification:** `npm test -- --watch=false` green (exit 0) + `npm run build` passes + manual pass (390px and desktop): drag across 5–7 cells — the moment the pointer is released, every painted cell already shows the selected color (no per-cell pop-in, no flash to empty); a single click also paints without a visible delay.
**Commit:** `apply calendar markings optimistically for instant feedback`
