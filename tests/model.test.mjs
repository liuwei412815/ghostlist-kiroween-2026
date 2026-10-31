import test from "node:test";
import assert from "node:assert/strict";
import {
  createTask, dayKey, isOverdue, makeSamples, mergeTasks, parseBackup,
  remainingSeconds, selectTasks, validDate,
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
