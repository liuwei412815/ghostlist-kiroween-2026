# Actual development record

## October 31, 2026 - Initial prototype

Authoring assistance: Codex.

Implemented:

- Original ghost and house SVG visuals; responsive task board.
- Validated task model, local storage, CRUD, completion, restoration and undo.
- Search, sorting, target dates, priority and estimates.
- Deadline-based focus timer with current-tab recovery.
- Export/import with schema validation and preservation of current tasks.
- Keyboard access, labelled controls and reduced-motion support.
- Dependency-free local server and model tests.

The initial test run passed all 9 model tests. JavaScript syntax checks passed.

Chrome verification completed:

- Create a task, reload, and verify it persists.
- Start and pause a 5-minute session on the selected task.
- Complete a task, verify At peace, then restore it.
- Edit the task and search for its changed title.
- Remove the generated test task and verify the undo control is offered.
- Inspect desktop and narrow-screen layouts; fix small-screen illustration
  overflow and overlap.
- Confirm no browser console errors were captured during those checks.

Desktop and mobile screenshots are saved in `screenshots/`.

Verification limitation: Chrome's automation extension blocked the test file
upload because local file URL access is disabled. The import model tests pass,
but the browser file-picker-to-import path was not completed.

## Kiro provenance

At the time of the initial prototype record, no Kiro development session had
been completed. The `.kiro/` specifications and steering were prepared by Codex
as inputs to the later Kiro session documented below.

The suggested next step was a complete optional recurring-task feature,
including local-calendar semantics, completion behavior, backup compatibility
and tests. Kiro implemented that feature in the session below.

## Publication

Sites project registered:
`appgprj_6ae5d424b5e48191bec1329b25d205b5`.

Registration is not publication. A public GitHub repository and YouTube video
have not yet been created. No final Devpost submission has been made.

## October 31, 2026 - Recurring task feature

Authoring assistance: Kiro CLI 2.37.0 (Kiro CLI V3, Google login).
Session: `sess_f4bc730c-12b2-4aa6-b77e-aa6176d4b61a`.
Reported cost and duration: 4.90 credits over 6m32s.

Implemented in this session:

- `dist/model.mjs`: Added `RECURRENCES` constant (`["none", "daily", "weekly"]`).
  Added `recurrence` field to `createTask()` with validation (defaults to `"none"`
  when omitted, for backward compatibility with legacy tasks and backups).
  Added `nextDueDate(task, now)`: uses the task's due date as the base if valid,
  otherwise today; adds 1 day for "daily" or 7 days for "weekly" using local
  calendar arithmetic via `Date.setDate()` to handle month/year/leap-day rollover
  correctly.
  Added `spawnNextTask(completedTask, allTasks, now)`: creates exactly one new
  active task for the next period, retaining title/notes/priority/estimate/
  recurrence and setting `spawnedFrom` to the completed task's ID for
  duplicate-prevention. Returns `null` if the task is non-recurring, if any task
  with the same `spawnedFrom` already exists, or if the board is at its task limit.
  Updated `parseBackup()`: accepts legacy tasks without a `recurrence` field
  (defaults to `"none"`), validates recurrence when present, and preserves
  `spawnedFrom` linkage when the value is a valid ID-safe string.

- `dist/app.js`: Imported `spawnNextTask`. Extended `releaseTask()` to call
  `spawnNextTask()` after marking a task complete and push the result (when
  non-null) before persisting. Extended `openTask()` to populate the recurrence
  select when editing. Extended `renderCard()` to append a `↺ daily` or
  `↺ weekly` badge to `.card-meta` for recurring tasks.

- `dist/index.html`: Added a "Does this come back?" `<select id="task-recurrence"
  name="recurrence">` to the task dialog form, with options "Just once" / "Every
  day" / "Every week". Placed after the due-date input, before the error paragraph.

- `dist/styles.css`: Added `.meta-recurrence` rule for the repeat badge in card
  metadata.

- `tests/model.test.mjs`: Extended from 9 tests to 28. New tests cover:
  recurrence field validation (valid values, default, invalid values); `nextDueDate`
  for daily and weekly recurrence including end-of-month, end-of-year and leap-day
  rollover (Feb 28 → Feb 29, Feb 29 → Mar 1, non-leap Feb 28 → Mar 1); fallback
  to today when due is empty; `spawnNextTask` creating correct next tasks for daily
  and weekly; null return for non-recurring tasks; no-duplicate prevention when an
  any next task already exists; no duplicate after restoring the original;
  the maximum task limit; legacy backup acceptance with default recurrence;
  invalid recurrence rejection; and `spawnedFrom` linkage preservation and
  rejection of invalid values.

All 28 tests pass. JavaScript syntax checks pass.

## October 31, 2026 - Post-Kiro audit

Authoring assistance: Codex.

Reviewed Kiro's changes and tightened three edge cases:

- Duplicate prevention now checks any generated child, including a completed
  child, so restoring and re-completing an old parent cannot create a sibling.
- Task edits retain the child's `spawnedFrom` linkage.
- Automatic spawning stops at the 1,000-task maximum.

Added a regression test for the maximum limit and updated the duplicate test.
Browser automation then verified the daily recurrence end-to-end: create,
complete, see the next due date, restore the parent, and re-complete it without
creating a third task.
