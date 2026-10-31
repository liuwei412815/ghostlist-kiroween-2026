---
inclusion: always
---

# Technical boundaries

Use vanilla HTML, CSS and JavaScript modules. The deployable static assets are
in `dist/`. There is no build step and no runtime dependency.

Keep pure state, validation and date calculations in `dist/model.mjs`.
Use `textContent` for task text; never interpolate user input into HTML.
The local server binds only to loopback.

Before completing a change, run `npm test` and `npm run check`.
Test meaningful failure cases when changing persistence or calendar behavior.
Use local calendar dates for task deadlines and elapsed time for focus timers.
Retain `.kiro/` in source control.

Document actual Kiro work in `docs/build-log.md`; do not retroactively attribute
the initial Codex prototype to Kiro.
