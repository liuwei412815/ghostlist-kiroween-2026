# GhostList

**Unfinished business, be gone.**

A small task manager that turns unfinished tasks into friendly ghosts.
Write down a next step, spend a little time with it, and release its ghost when
you are done. The Halloween treatment is part of the interaction: priority
changes a ghost's card, completion sends it away, and the "At peace" view keeps
finished tasks available without making them compete for attention.

## Run

Requires Node.js 20 or newer. There are no runtime packages to install.

```sh
npm start
```

Open `http://127.0.0.1:4173`. Use a static HTTP server instead of opening
`index.html` directly, because the app uses ES modules. Any static host can serve
the contents of `dist/`.

## What works

- Create, edit, remove and restore tasks.
- Three priorities, optional target dates and 5/15/25/50-minute estimates.
- Optional daily or weekly recurrence: completing a recurring task automatically
  creates the next occurrence with the correct due date. A second next task is
  never created for the same completed task.
- Search, sorting, active/completed views and daily completion counts.
- Completion animation, an undo action and a reduced-motion alternative.
- 5-, 15- and 25-minute focus sessions with pause, resume and reset.
- Timer recovery in the current tab, based on an absolute deadline.
- Local browser persistence and updates from other tabs on the same origin.
- JSON export and validated, non-destructive import (backward-compatible with
  pre-recurrence backups; the `recurrence` field defaults to `"none"` when absent).
- Responsive layout, keyboard shortcuts, native dialogs and labelled controls.
- Three clearly identified sample tasks to explore on first use.

There is no task server, account system, AI runtime or cross-device sync.
Hosting the app privately may add a hosting-provider access check.

## Demo

An actual 56-second application walkthrough is included at
`docs/demo.mp4`. It records the working local build, including creating a
recurring task, starting a focus session, releasing the completed task, and
showing the next occurrence. The narration explicitly distinguishes the Kiro CLI
work from the earlier Codex-authored prototype.

## Privacy and data

Task content is stored in this browser's local storage. The application does not
send task content to a backend. Other people using the same browser profile can
see the board. Clearing site data removes it, and different origins have separate
boards. Export a backup before changing browsers or deployment URLs.

Import validates the whole file before adding anything. An existing task ID wins
over an imported copy, so an old backup cannot reverse a completed task. Import
does not replace existing tasks. Files are limited to 1.5 MB and 1,000 tasks.

If storage is blocked, full, or corrupt, the app warns the user and keeps the
current session usable. Corrupt saved data is not overwritten automatically.

## Checks

```sh
npm test
npm run check
```

The tests cover task validation, calendar boundaries, local-date overdue logic,
filters and stable input data, backup validation, duplicate IDs, merge
preservation, maximum size and elapsed-time timer behavior.

## Source map

- `dist/index.html`: accessible page and dialog structure.
- `dist/styles.css`: responsive visual design and motion.
- `dist/app.js`: task UI, persistence, backup and focus session behavior.
- `dist/model.mjs`: pure task, date, validation and timer calculations.
- `server.mjs`: small local static server, bound to loopback.
- `tests/model.test.mjs`: dependency-free Node test suite.
- `.kiro/`: proposed specifications and steering for a subsequent Kiro session.
- `docs/`: draft submission text, demo plan and actual build provenance.
- `docs/kiro-build.md`: factual record of the Kiro CLI development session.

## Kiroween status

Planned category: **Costume Contest**.

The initial prototype was prepared with Codex on October 31, 2026. The recurring
task feature (recurrence field, next-occurrence spawning, duplicate prevention,
backward-compatible import and extended test suite) was implemented by Kiro on
October 31, 2026. See `docs/build-log.md` for the full record.

Before final hackathon submission, publish the source to a public GitHub
repository; make a public functional demo available; and record and publish an
actual demo on YouTube. `docs/build-log.md` tracks this distinction.

## License and assets

MIT. The ghost, house, stars and favicon are original SVG artwork authored in
this repository. The app uses locally available font families and no external
images, music, datasets, tracking libraries or CDN dependencies.
