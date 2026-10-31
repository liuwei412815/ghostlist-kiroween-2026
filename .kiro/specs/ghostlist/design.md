# GhostList design

Provenance: Codex-authored design notes, ready for review in Kiro.

## Architecture

The static app uses a pure model module and a DOM controller.
The controller renders task text through text nodes and stores a versioned
document at `ghostlist.tasks.v1`. A separate tab-scoped focus record stores its
duration, remaining seconds, selected task and absolute deadline.

## Data shape

Each task has `id`, `title`, `notes`, `priority`, `estimate`, `due`,
`createdAt`, `completedAt` and `sample`. `due` is either empty or YYYY-MM-DD.
`completedAt` is null while active and an ISO timestamp when completed.

## Visual language

Cream paper, forest-green ink, rust accents and soft sage cards.
Serif display type, small utility labels and original outlined ghost artwork.
High priority has a warm card; low priority has a cool card. Every state also
has a text label. The focus panel offers one task and one clear timer action.

## Verification

Model tests cover validation, calendar rollover, filtering, backup preservation
and timer calculations. Browser checks should cover the actual task lifecycle,
reload persistence, focus interaction, keyboard use and mobile layout.
