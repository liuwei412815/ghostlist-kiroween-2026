# GhostList requirements

Provenance: prepared by Codex as planning inputs. Kiro validation is pending.

## Task lifecycle

1. When a user saves a nonempty title with valid fields, the app shall add a task.
2. When input is invalid, the app shall explain the problem and keep the form.
3. When a user completes a task, the app shall move it from Haunting to At peace.
4. When a user restores a task, the app shall return it to Haunting.
5. When a user removes a task, the app shall offer an immediate undo action.
6. A task date shall represent the user's local calendar date.

## Focus

1. The user shall choose an active task and a 5-, 15- or 25-minute session.
2. The user shall be able to pause, resume and reset.
3. The remaining time shall follow elapsed time across background-tab throttling.
4. Finishing a timer shall not automatically complete a task.

## Data

1. Task content shall remain in browser storage unless the user exports it.
2. Import shall validate the entire file before changing the board.
3. Import shall preserve the current copy of an existing task ID.
4. Storage failure shall be visible and shall not make the current page unusable.
5. Invalid saved data shall not be silently overwritten.

## Accessibility and theme

1. The interface shall work with keyboard navigation and labelled controls.
2. Reduced-motion preferences shall disable decorative movement.
3. Task information and actions shall remain readable on a narrow screen.
4. The ghost theme shall support completion and focus, without punitive language.
