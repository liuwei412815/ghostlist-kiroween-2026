export const PRIORITIES = ["low", "medium", "high"];
export const ESTIMATES = [5, 15, 25, 50];
export const RECURRENCES = ["none", "daily", "weekly"];
export const MAX_TASKS = 1000;

export function dayKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

export function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(`${value}T12:00:00`);
  return year >= 1900 && year <= 9999 &&
    date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function createTask(input, now = new Date(), id = crypto.randomUUID()) {
  const title = String(input.title ?? "").trim();
  const notes = String(input.notes ?? "").trim();
  const due = String(input.due ?? "");
  const recurrence = String(input.recurrence ?? "none");
  if (!title || title.length > 100) throw new Error("Give your ghost a name, up to 100 characters.");
  if (notes.length > 500) throw new Error("Keep the details under 500 characters.");
  if (due && !validDate(due)) throw new Error("Choose a valid date.");
  if (!PRIORITIES.includes(input.priority)) throw new Error("Choose a priority.");
  if (!ESTIMATES.includes(Number(input.estimate))) throw new Error("Choose a task size.");
  if (!RECURRENCES.includes(recurrence)) throw new Error("Choose a valid recurrence.");
  return {
    id, title, notes, due, priority: input.priority, estimate: Number(input.estimate),
    recurrence,
    createdAt: now.toISOString(), completedAt: null, sample: false,
  };
}

export function isOverdue(task, today = dayKey()) {
  return !task.completedAt && Boolean(task.due) && task.due < today;
}

export function selectTasks(tasks, { view = "active", search = "", sort = "priority" } = {}) {
  const query = search.trim().toLocaleLowerCase();
  const result = tasks.filter(task =>
    (view === "released" ? Boolean(task.completedAt) : !task.completedAt) &&
    (!query || `${task.title} ${task.notes}`.toLocaleLowerCase().includes(query)),
  );
  const rank = { high: 0, medium: 1, low: 2 };
  result.sort((a, b) => {
    if (view === "released") return b.completedAt.localeCompare(a.completedAt);
    if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
    if (sort === "smallest") return a.estimate - b.estimate || a.createdAt.localeCompare(b.createdAt);
    if (sort === "due") return (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31") ||
      rank[a.priority] - rank[b.priority];
    return rank[a.priority] - rank[b.priority] ||
      (a.due || "9999-12-31").localeCompare(b.due || "9999-12-31") ||
      a.createdAt.localeCompare(b.createdAt);
  });
  return result;
}

function validTimestamp(value) {
  return typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T/.test(value) &&
    Number.isFinite(Date.parse(value));
}

export function parseBackup(text) {
  if (typeof text !== "string" || text.length > 1500000) throw new Error("That backup is too large.");
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("That file isn't a valid JSON backup."); }
  if (!data || data.version !== 1 || !Array.isArray(data.tasks)) {
    throw new Error("Choose a GhostList version 1 backup.");
  }
  if (data.tasks.length > MAX_TASKS) throw new Error(`A backup can hold up to ${MAX_TASKS} tasks.`);
  const ids = new Set();
  const tasks = data.tasks.map(raw => {
    if (!raw || typeof raw !== "object" ||
      typeof raw.id !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(raw.id) ||
      ids.has(raw.id) || !validTimestamp(raw.createdAt) ||
      !(raw.completedAt === null || validTimestamp(raw.completedAt)) ||
      typeof raw.title !== "string" || typeof raw.notes !== "string" ||
      typeof raw.due !== "string" || typeof raw.estimate !== "number") {
      throw new Error("That backup contains an invalid or duplicate task.");
    }
    // Legacy tasks without recurrence default to "none"; validate if present.
    const recurrence = raw.recurrence != null ? raw.recurrence : "none";
    const task = createTask({ ...raw, recurrence }, new Date(raw.createdAt), raw.id);
    task.completedAt = raw.completedAt ? new Date(raw.completedAt).toISOString() : null;
    task.sample = raw.sample === true;
    // Preserve source linkage fields if present and valid.
    if (typeof raw.spawnedFrom === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(raw.spawnedFrom)) {
      task.spawnedFrom = raw.spawnedFrom;
    }
    ids.add(task.id);
    return task;
  });
  return tasks;
}

export function mergeTasks(current, incoming) {
  // Existing tasks win so importing an old backup cannot undo current work.
  const ids = new Set(current.map(task => task.id));
  const added = incoming.filter(task => !ids.has(task.id));
  if (current.length + added.length > MAX_TASKS) {
    throw new Error(`Keep your library under ${MAX_TASKS} tasks.`);
  }
  return { tasks: [...current, ...added], added: added.length };
}

/**
 * Compute the next due date for a recurring task.
 * Uses the task's due date if valid; otherwise falls back to today (dayKey(now)).
 * Adds 1 day for "daily" or 7 days for "weekly".
 * Returns a YYYY-MM-DD string.
 */
export function nextDueDate(task, now = new Date()) {
  const base = task.due && validDate(task.due) ? task.due : dayKey(now);
  const [year, month, day] = base.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  if (task.recurrence === "daily") {
    d.setDate(d.getDate() + 1);
  } else if (task.recurrence === "weekly") {
    d.setDate(d.getDate() + 7);
  }
  return dayKey(d);
}

/**
 * When a recurring task is completed, spawn a fresh active task for the next period.
 * Prevents duplicates: if any task already has spawnedFrom === completedTask.id,
 * do nothing and return null.
 * Returns the new task, or null if no spawn is needed.
 */
export function spawnNextTask(completedTask, allTasks, now = new Date()) {
  if (!completedTask.recurrence || completedTask.recurrence === "none") return null;
  // Prevent duplicate: a next task already exists for this completed task.
  const alreadySpawned = allTasks.some(t => t.spawnedFrom === completedTask.id);
  if (alreadySpawned || allTasks.length >= MAX_TASKS) return null;
  const due = nextDueDate(completedTask, now);
  const next = createTask({
    title: completedTask.title,
    notes: completedTask.notes,
    priority: completedTask.priority,
    estimate: completedTask.estimate,
    recurrence: completedTask.recurrence,
    due,
  }, now);
  next.spawnedFrom = completedTask.id;
  return next;
}

export function makeSamples(now = new Date()) {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return [
    { title: "Send that one email", notes: "You know the one. A short reply is a great start.", priority: "high", estimate: 5, due: dayKey(yesterday) },
    { title: "Make space for a good idea", notes: "Clear one small corner of your desk. Leave room for something new.", priority: "medium", estimate: 15, due: dayKey(now) },
    { title: "Take your idea for a walk", notes: "Step away from the screen and let a half-formed thought find its feet.", priority: "low", estimate: 25, due: dayKey(tomorrow) },
  ].map((input, index) => ({ ...createTask(input, now, `sample-${index + 1}`), sample: true }));
}

export function remainingSeconds(deadline, now = Date.now()) {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
