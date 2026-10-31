# Devpost draft

Status: Draft. Kiro implementation is complete; public links and final submission
still need to be completed. Do not substitute placeholders for real URLs.

## Project name

GhostList

## Elevator pitch

Turn unfinished tasks into friendly ghosts. Pick one, take a small step, and let it go. A playful, private-in-your-browser way to make room for a lighter mind.

## Category

Costume Contest

## Inspiration

Some tasks are small, but they take up a surprising amount of space in your
head. The email you keep putting off. The first draft you have not started.
We wanted a task list that felt a little less stern and a little more human.
GhostList gives those loose ends a friendly face, then lets you send them on
their way.

## What it does

GhostList turns your unfinished tasks into little ghosts. You can give each one
a name, a next step, a priority, an optional date and a rough time estimate.
Pick a single ghost for a short focus session. When you finish the task, release
it with a small animation and find it later in the At peace view.

The app supports editing, search, sorting, undo and restoring completed tasks.
Tasks stay in your browser. JSON export and import let you keep your own backup
without creating an account.

Daily and weekly tasks can return automatically. Finishing one creates the next
occurrence from its local calendar date and keeps a source link so restoring and
finishing the original cannot produce a duplicate.

## How we built it

The current prototype uses semantic HTML, CSS, vanilla JavaScript and the
browser's local storage. The ghost illustrations are original inline SVGs.
Task validation and date calculations are separate from the interface, so the
core behavior can be tested with Node's built-in test runner.

The focus timer uses a deadline rather than counting interval ticks. This keeps
it honest when the browser slows down background tabs. Backup import validates
the entire file first and preserves the user's current copy of an existing task.

Development provenance: the initial prototype was prepared with Codex. Kiro CLI
2.37 then implemented the recurring-task system, compatibility handling and 18
new tests, taking 4.90 credits in a 6m32s agent session. Codex performed the final
edge-case audit after that session.

## Challenges we ran into

The playful design needed to stay useful. Each ghost still needed a readable
task name, a clear action and a priority that made sense without relying only on
color. We also had to handle local calendar dates, interrupted focus sessions
and old backups without quietly losing someone's work.

## Accomplishments that we're proud of

The app has a complete create-focus-complete-restore loop. The Halloween theme
supports the task interaction, and the same board adapts to a smaller screen.
The core app has no external runtime dependencies.

## What we learned

A small, predictable interaction can carry a theme better than a large amount
of decoration. Making the data model boring and testable leaves room for the
interface to have a little personality.

## What's next

Complete and document a substantive Kiro development session, run additional
accessibility checks, and explore optional recurring tasks without adding guilt
or complexity to the board.

## Built with

JavaScript, HTML5, CSS3, SVG, LocalStorage, Node.js

Only add Kiro to this list after actual usage is documented.

## Kiro usage field

I used Kiro CLI 2.37 in the project root with Kiro's V3 agent and workspace trust.
It read the README, task model, UI, tests, steering documents and spec. It then
implemented daily/weekly recurrence in the task model and dialog, generated the
next occurrence on completion, added source linkage for duplicate prevention,
extended backup compatibility, updated the documentation and tests, and ran the
test suite and syntax checks. Kiro reported 4.90 credits over 6m32s and finished
with 27/27 tests passing. I then audited the edge cases and added one more test,
bringing the verified suite to 28 tests.

## Links still required

- Public functional demo: https://ghostlist-kiroween-2026.poeticharp22.chatgpt.site
- Public GitHub repository: https://github.com/liuwei412815/ghostlist-kiroween-2026
- Public YouTube demo URL, ideally under 3 minutes.
