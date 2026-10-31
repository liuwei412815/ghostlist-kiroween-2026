import test from "node:test";
import assert from "node:assert/strict";
import {
  createTask, dayKey, isOverdue, makeSamples, mergeTasks, nextDueDate,
  parseBackup, remainingSeconds, selectTasks, spawnNextTask, validDate,
} from "../dist/model.mjs";

const now = new Date("2026-10-31T12:00:00Z");
const draft = { title: "  A first step  ", notes: "", priority: "medium", due: "", estimate: 15 };
const task = (changes = {}, id = "task-1") => createTask({ ...draft, ...changes }, now, id);
const backup = tasks => JSON.stringify({ version: 1, tasks });

test("task input is normalized without interpreting HTML", () => {
  assert.equal(task().title, "A first step");
  assert.equal(task({ title: '<img src=x onerror="alert(1)">' }).title, '<img src=x onerror="alert(1)">');
  assert.throws(() => task({ title: "  " }));
  assert.throws(() => task({ title: "x".repeat(101) }));
  assert.throws(() => task({ notes: "x".repeat(501) }));
  assert.throws(() => task({ priority: "urgent" }));
  assert.throws(() => task({ estimate: -1 }));
});

test("calendar dates reject rollover and handle leap years", () => {
  assert.equal(validDate("2028-02-29"), true);
  for (const date of ["2026-02-29", "2026-02-31", "2026-13-01", "2026-1-2", "banana", "0099-01-01"]) {
    assert.equal(validDate(date), false);
    assert.throws(() => task({ due: date }));
  }
  assert.equal(dayKey(new Date(2026, 9, 31, 0, 5)), "2026-10-31");
});

test("overdue status uses local calendar day, excludes completed tasks", () => {
  assert.equal(isOverdue(task({ due: "2026-10-30" }), "2026-10-31"), true);
  assert.equal(isOverdue(task({ due: "2026-10-31" }), "2026-10-31"), false);
  assert.equal(isOverdue(task(), "2026-10-31"), false);
  assert.equal(isOverdue({ ...task({ due: "2026-10-30" }), completedAt: now.toISOString() }, "2026-10-31"), false);
});

test("filtering and sorting leave original data unchanged", () => {
  const low = task({ title: "Take a walk", priority: "low", estimate: 25 }, "low");
  const high = task({ title: "Send email", priority: "high", estimate: 5, due: "2026-11-01" }, "high");
  const done = { ...task({}, "done"), completedAt: now.toISOString() };
  const tasks = [low, done, high];
  assert.deepEqual(selectTasks(tasks).map(x => x.id), ["high", "low"]);
  assert.deepEqual(selectTasks(tasks, { sort: "due" }).map(x => x.id), ["high", "low"]);
  assert.deepEqual(selectTasks(tasks, { sort: "smallest" }).map(x => x.id), ["high", "low"]);
  assert.deepEqual(selectTasks(tasks, { search: " EMAIL " }).map(x => x.id), ["high"]);
  assert.deepEqual(selectTasks(tasks, { view: "released" }).map(x => x.id), ["done"]);
  assert.deepEqual(tasks.map(x => x.id), ["low", "done", "high"]);
});

test("backup roundtrip preserves actual tasks and rejects damaged data", () => {
  const tasks = [task(), ...makeSamples(now)];
  assert.deepEqual(parseBackup(backup(tasks)), tasks);
  assert.throws(() => parseBackup("{bad"));
  assert.throws(() => parseBackup(JSON.stringify({ version: 2, tasks })));
  assert.throws(() => parseBackup(backup([task(), task()])));
  assert.throws(() => parseBackup(backup([{ ...task(), id: "<script>" }])));
  assert.throws(() => parseBackup(backup([{ ...task(), createdAt: "wrong" }])));
  assert.throws(() => parseBackup(backup([{ ...task(), completedAt: 123 }])));
  assert.throws(() => parseBackup(backup([{ ...task(), notes: {} }])));
  assert.throws(() => parseBackup(" ".repeat(1500001)));
});

test("legacy backups without recurrence field are accepted with default 'none'", () => {
  const legacyTask = task();
  const raw = { ...legacyTask };
  delete raw.recurrence;
  const restored = parseBackup(backup([raw]));
  assert.equal(restored[0].recurrence, "none");
  assert.equal(restored[0].title, legacyTask.title);
});

test("backup rejects invalid recurrence value", () => {
  const bad = { ...task(), recurrence: "monthly" };
  assert.throws(() => parseBackup(backup([bad])));
});

test("backup preserves spawnedFrom linkage when valid", () => {
  const parent = task({}, "parent-1");
  const child = { ...task({ title: "Child" }, "child-1"), spawnedFrom: "parent-1", recurrence: "daily" };
  const restored = parseBackup(backup([parent, child]));
  assert.equal(restored[1].spawnedFrom, "parent-1");
});

test("backup ignores invalid spawnedFrom values", () => {
  const bad = { ...task({ recurrence: "daily" }, "task-x"), spawnedFrom: "<bad!>" };
  const restored = parseBackup(backup([bad]));
  assert.equal(restored[0].spawnedFrom, undefined);
});

test("restoring an older backup never overwrites a newer existing task", () => {
  const current = { ...task(), completedAt: now.toISOString() };
  const merged = mergeTasks([current], [task(), task({ title: "Second" }, "task-2")]);
  assert.equal(merged.added, 1);
  assert.equal(merged.tasks.length, 2);
  assert.equal(merged.tasks[0].completedAt, now.toISOString());
});

test("import limit is enforced before mutating existing tasks", () => {
  const existing = Array.from({ length: 1000 }, (_, i) => task({}, `task-${i}`));
  assert.throws(() => mergeTasks(existing, [task({}, "extra")]));
  assert.equal(existing.length, 1000);
  assert.equal(mergeTasks(existing, existing).added, 0);
});

test("focus clock accounts for elapsed time and never goes negative", () => {
  const deadline = 100000;
  assert.equal(remainingSeconds(deadline, 40000), 60);
  assert.equal(remainingSeconds(deadline, 99999), 1);
  assert.equal(remainingSeconds(deadline, 100000), 0);
  assert.equal(remainingSeconds(deadline, 100500), 0);
});

test("samples use relative dates across month and year boundaries", () => {
  const samples = makeSamples(new Date(2027, 0, 1, 12));
  assert.deepEqual(samples.map(x => x.due), ["2026-12-31", "2027-01-01", "2027-01-02"]);
  assert.ok(samples.every(x => x.sample && !x.completedAt));
});

// --- Recurrence validation ---

test("createTask accepts valid recurrence values", () => {
  assert.equal(task({ recurrence: "none" }).recurrence, "none");
  assert.equal(task({ recurrence: "daily" }).recurrence, "daily");
  assert.equal(task({ recurrence: "weekly" }).recurrence, "weekly");
});

test("createTask defaults recurrence to 'none' when omitted", () => {
  const t = createTask({ title: "Ghost", priority: "low", estimate: 5, notes: "", due: "" }, now);
  assert.equal(t.recurrence, "none");
});

test("createTask rejects invalid recurrence value", () => {
  assert.throws(() => task({ recurrence: "monthly" }));
  assert.throws(() => task({ recurrence: "" }));
  assert.throws(() => task({ recurrence: "DAILY" }));
});

// --- nextDueDate ---

test("nextDueDate adds one day for daily recurrence", () => {
  const t = task({ due: "2026-10-31", recurrence: "daily" });
  assert.equal(nextDueDate(t, now), "2026-11-01");
});

test("nextDueDate adds seven days for weekly recurrence", () => {
  const t = task({ due: "2026-10-31", recurrence: "weekly" });
  assert.equal(nextDueDate(t, now), "2026-11-07");
});

test("nextDueDate rolls over at end of month", () => {
  const t = task({ due: "2026-10-31", recurrence: "daily" });
  assert.equal(nextDueDate(t, now), "2026-11-01");
});

test("nextDueDate rolls over at end of year", () => {
  const t = task({ due: "2026-12-31", recurrence: "daily" });
  assert.equal(nextDueDate(t, now), "2027-01-01");
  const tw = task({ due: "2026-12-25", recurrence: "weekly" });
  assert.equal(nextDueDate(tw, now), "2027-01-01");
});

test("nextDueDate handles leap day rollover correctly", () => {
  // Feb 28 + 1 day in non-leap year → Mar 1
  const tNonLeap = task({ due: "2026-02-28", recurrence: "daily" });
  assert.equal(nextDueDate(tNonLeap, now), "2026-03-01");
  // Feb 28 + 1 day in leap year → Feb 29
  const tLeap = task({ due: "2028-02-28", recurrence: "daily" });
  assert.equal(nextDueDate(tLeap, now), "2028-02-29");
  // Feb 29 + 1 day in leap year → Mar 1
  const tLeapDay = task({ due: "2028-02-29", recurrence: "daily" });
  assert.equal(nextDueDate(tLeapDay, now), "2028-03-01");
  // Feb 22 + 7 days in leap year → Feb 29
  const tLeapWeek = task({ due: "2028-02-22", recurrence: "weekly" });
  assert.equal(nextDueDate(tLeapWeek, now), "2028-02-29");
});

test("nextDueDate falls back to today when due is empty", () => {
  const t = task({ due: "", recurrence: "daily" });
  // now is 2026-10-31T12:00:00Z; local date is the same in most zones,
  // but we pass now explicitly so the result is deterministic.
  const localToday = dayKey(now);
  const [y, m, d] = localToday.split("-").map(Number);
  const tomorrow = new Date(y, m - 1, d + 1);
  assert.equal(nextDueDate(t, now), dayKey(tomorrow));
});

// --- spawnNextTask ---

test("spawnNextTask creates a new active task for daily recurrence", () => {
  const parent = { ...task({ due: "2026-10-31", recurrence: "daily" }), completedAt: now.toISOString() };
  const next = spawnNextTask(parent, [parent], now);
  assert.ok(next, "next task should be created");
  assert.equal(next.due, "2026-11-01");
  assert.equal(next.recurrence, "daily");
  assert.equal(next.title, parent.title);
  assert.equal(next.completedAt, null);
  assert.notEqual(next.id, parent.id);
  assert.equal(next.spawnedFrom, parent.id);
});

test("spawnNextTask creates a new active task for weekly recurrence", () => {
  const parent = { ...task({ due: "2026-10-31", recurrence: "weekly" }), completedAt: now.toISOString() };
  const next = spawnNextTask(parent, [parent], now);
  assert.ok(next);
  assert.equal(next.due, "2026-11-07");
  assert.equal(next.recurrence, "weekly");
  assert.equal(next.spawnedFrom, parent.id);
});

test("spawnNextTask returns null for non-recurring tasks", () => {
  const parent = { ...task({ due: "2026-10-31", recurrence: "none" }), completedAt: now.toISOString() };
  assert.equal(spawnNextTask(parent, [parent], now), null);
});

test("spawnNextTask prevents duplicate: does not spawn if next task already exists", () => {
  const parent = { ...task({ due: "2026-10-31", recurrence: "daily" }, "p-1"), completedAt: now.toISOString() };
  // Simulate an already-spawned next task
  const existing = { ...task({ due: "2026-11-01", recurrence: "daily" }, "c-1"), spawnedFrom: "p-1" };
  const result = spawnNextTask(parent, [parent, existing], now);
  assert.equal(result, null);
});

test("spawnNextTask does not duplicate a next task after the original is restored", () => {
  const parent = { ...task({ due: "2026-10-31", recurrence: "daily" }, "p-1"), completedAt: now.toISOString() };
  const completedChild = {
    ...task({ due: "2026-11-01", recurrence: "daily" }, "c-1"),
    completedAt: now.toISOString(),
    spawnedFrom: "p-1",
  };
  const result = spawnNextTask(parent, [parent, completedChild], now);
  assert.equal(result, null);
});

test("spawnNextTask does not exceed the task limit", () => {
  const parent = { ...task({ recurrence: "daily" }, "p-1"), completedAt: now.toISOString() };
  const fullBoard = Array.from({ length: 1000 }, (_, index) =>
    index === 0 ? parent : task({ title: `Ghost ${index}` }, `task-${index}`)
  );
  assert.equal(spawnNextTask(parent, fullBoard, now), null);
});
