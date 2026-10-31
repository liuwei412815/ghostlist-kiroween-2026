# Devpost draft

Status: Draft only. Public links and real Kiro usage must be completed before
final submission. Do not substitute placeholders for real URLs in the form.

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

## How we built it

The current prototype uses semantic HTML, CSS, vanilla JavaScript and the
browser's local storage. The ghost illustrations are original inline SVGs.
Task validation and date calculations are separate from the interface, so the
core behavior can be tested with Node's built-in test runner.

The focus timer uses a deadline rather than counting interval ticks. This keeps
it honest when the browser slows down background tabs. Backup import validates
the entire file first and preserves the user's current copy of an existing task.

Development provenance: this initial prototype was prepared with Codex.
A Kiro development session is still required for the hackathon entry.

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

Pending. Replace this section with a factual account of the Kiro features used,
the files changed, decisions made and verification performed. The existence of
`.kiro/` planning files alone is not evidence of Kiro development.

## Links still required

- Public functional demo URL, accessible to judges.
- Public GitHub repository URL with MIT license and `.kiro/` tracked.
- Public YouTube demo URL, ideally under 3 minutes.
