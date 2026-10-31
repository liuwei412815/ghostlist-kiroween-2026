export const PRIORITIES = ["low", "medium", "high"];
export const ESTIMATES = [5, 15, 25, 50];
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
  if (!title || title.length > 100) throw new Error("Give your ghost a name, up to 100 characters.");
  if (notes.length > 500) throw new Error("Keep the details under 500 characters.");
  if (due && !validDate(due)) throw new Error("Choose a valid date.");
  if (!PRIORITIES.includes(input.priority)) throw new Error("Choose a priority.");
  if (!ESTIMATES.includes(Number(input.estimate))) throw new Error("Choose a task size.");
  return {
    id, title, notes, due, priority: input.priority, estimate: Number(input.estimate),
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
    const task = createTask(raw, new Date(raw.createdAt), raw.id);
    task.completedAt = raw.completedAt ? new Date(raw.completedAt).toISOString() : null;
    task.sample = raw.sample === true;
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
