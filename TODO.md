# TODO

> **For the coding agent:** Work through tasks in order, subtasks top to bottom.
> **STOP and ask the user for approval before starting each next subtask.** After finishing a subtask, show what changed (files touched + how it was verified) and wait for a "yes/continue" before moving on.
> After all subtasks of a task are done, run the task's verification command, then commit everything with the given message (one commit per task). Do not commit earlier.

## Done

- ~~Remove period (range) selection — day-by-day only~~ — commit `remove period selection from the calendar, keep day-by-day only`
- ~~Deselect by clicking a marked day; recolor on click~~ — commit `unselect calendar days by clicking them and recolor on click`
- ~~Select days by click and swipe~~ — commit `select calendar days by click and swipe`
- ~~Marking overwrites smoothly — no errors, paint with the selected color~~ — commit `make calendar marking overwrite existing days instead of erroring`

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
