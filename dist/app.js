import {
  MAX_TASKS, createTask, dayKey, isOverdue, makeSamples, mergeTasks,
  parseBackup, remainingSeconds, selectTasks, spawnNextTask,
} from "./model.mjs";

const $ = id => document.getElementById(id);
const STORAGE_KEY = "ghostlist.tasks.v1";
const TIMER_KEY = "ghostlist.focus.v1";
const priorities = { high: "Needs attention", medium: "A little nudge", low: "A quiet whisper" };
let tasks = [];
let storageAvailable = true;
let view = "active";
let editingId = null;
let pendingDelete = null;
let toastTimeout;
let undoAction = null;
let focusId = "";
let duration = 25 * 60;
let remaining = duration;
let deadline = null;
let timerFinished = false;
let timerTaskBeforeRestore = "";
let activeDay = dayKey();

function storageWarning(message) {
  $("storage-warning").textContent = message;
  $("storage-warning").hidden = false;
}

function loadTasks() {
  let saved;
  try { saved = localStorage.getItem(STORAGE_KEY); }
  catch {
    storageAvailable = false;
    storageWarning("This browser can't save tasks right now. Export a backup before closing this page.");
  }
  if (saved != null) {
    try { tasks = parseBackup(saved); }
    catch {
      storageAvailable = false;
      storageWarning("Your saved data couldn't be read. It has been left untouched. New tasks are temporary; export them before closing.");
    }
  } else {
    tasks = makeSamples();
    persist();
  }
}

function persist() {
  if (!storageAvailable) return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, tasks })); }
  catch {
    storageAvailable = false;
    storageWarning("Your browser couldn't save the latest changes. Export a backup to keep your work.");
  }
}

function notify(message, undo = null) {
  clearTimeout(toastTimeout);
  $("toast-message").textContent = message;
  undoAction = undo;
  $("toast-undo").hidden = !undo;
  $("toast").classList.add("visible");
  toastTimeout = setTimeout(() => $("toast").classList.remove("visible"), undo ? 10000 : 5000);
}

function icon(name, className = "") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("aria-hidden", "true");
  if (className) svg.setAttribute("class", className);
  const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
  use.setAttribute("href", `#${name}`);
  svg.append(use);
  return svg;
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(className, text, action, label) {
  const node = el("button", className, text);
  node.type = "button";
  if (label) node.setAttribute("aria-label", label);
  node.addEventListener("click", action);
  return node;
}

function dueLabel(task) {
  if (task.completedAt) {
    const completed = new Date(task.completedAt);
    return dayKey(completed) === dayKey() ? "Released today" :
      `Released ${completed.toLocaleDateString("en", { month: "short", day: "numeric" })}`;
  }
  if (!task.due) return "No rush date";
  if (isOverdue(task)) return "A little overdue";
  if (task.due === dayKey()) return "Aiming for today";
  return new Date(`${task.due}T12:00:00`).toLocaleDateString("en", { month: "short", day: "numeric" });
}

function closeMenus() {
  document.querySelectorAll(".card-menu").forEach(menu => {
    menu.hidden = true;
    menu.closest(".task-card")?.querySelector(".card-more")?.setAttribute("aria-expanded", "false");
  });
}

function renderCard(task, index) {
  const card = el("article", `task-card${task.completedAt ? " released" : ""}`);
  card.dataset.priority = task.priority;
  card.dataset.id = task.id;
  card.setAttribute("aria-label", task.title);
  card.style.animationDelay = `${Math.min(index, 5) * 40}ms`;
  const top = el("div", "card-top");
  top.append(el("span", "priority-badge", task.completedAt ? "At peace" : priorities[task.priority]));
  const more = button("card-more", "\u00b7\u00b7\u00b7", event => {
    const open = menu.hidden;
    closeMenus();
    menu.hidden = !open;
    more.setAttribute("aria-expanded", String(open));
    event.stopPropagation();
  }, `Options for ${task.title}`);
  more.setAttribute("aria-expanded", "false");
  more.setAttribute("aria-controls", `menu-${task.id}`);
  top.append(more);
  const menu = el("div", "card-menu");
  menu.id = `menu-${task.id}`;
  menu.hidden = true;
  menu.append(
    button("", "Edit task", () => openTask(task.id)),
    button("remove", "Remove task", () => {
      pendingDelete = task.id;
      $("delete-description").textContent = `"${task.title}" will be removed. You can undo this immediately afterward.`;
      $("delete-dialog").showModal();
      $("cancel-delete").focus();
    }),
  );
  const art = el("div", "card-art");
  art.append(icon("ghost"));
  const title = el("h3", "card-name", task.title);
  const notes = el("p", "card-notes", task.notes || "One small step is all it takes.");
  const meta = el("div", "card-meta");
  const time = el("span", "meta-estimate");
  time.append(icon("clock"), document.createTextNode(`${task.estimate} min`));
  const due = el("span", isOverdue(task) ? "due-late" : "", dueLabel(task));
  if (task.due) due.title = `Target date: ${task.due}`;
  meta.append(time, due);
  if (task.recurrence && task.recurrence !== "none") {
    const rec = el("span", "meta-recurrence");
    rec.textContent = task.recurrence === "daily" ? "\u21ba daily" : "\u21ba weekly";
    rec.title = task.recurrence === "daily" ? "Repeats every day" : "Repeats every week";
    meta.append(rec);
  }
  const bottom = el("div", "card-bottom");
  if (task.completedAt) {
    bottom.append(button("release-button", "Bring it back", () => restoreTask(task.id), `Restore ${task.title}`));
  } else {
    const release = button("release-button", "", () => releaseTask(task.id, card), `Complete ${task.title}`);
    release.append(icon("check"), document.createTextNode("Let it go"));
    bottom.append(
      release,
      button("focus-link", "Focus on this \u2197", () => chooseFocus(task.id), `Focus on ${task.title}`),
    );
  }
  card.append(top, menu, art, title, notes, meta, bottom);
  return card;
}

function render() {
  const active = tasks.filter(task => !task.completedAt);
  const released = tasks.length - active.length;
  const releasedToday = tasks.filter(task => task.completedAt && dayKey(new Date(task.completedAt)) === dayKey()).length;
  $("active-count").textContent = active.length;
  $("released-count").textContent = released;
  $("active-tab").classList.toggle("active", view === "active");
  $("released-tab").classList.toggle("active", view === "released");
  $("active-tab").setAttribute("aria-pressed", String(view === "active"));
  $("released-tab").setAttribute("aria-pressed", String(view === "released"));
  $("sort-select").disabled = view === "released";
  $("progress-fill").style.width = `${tasks.length ? released / tasks.length * 100 : 0}%`;
  $("progress-count").textContent = `${released} of ${tasks.length} released`;
  $("progress-message").textContent = releasedToday
    ? `${releasedToday} little ${releasedToday === 1 ? "ghost" : "ghosts"} released today. Look at you making room.`
    : active.length ? "You don't have to do it all. Start with one little ghost." : "A clear board. A little room to breathe.";
  $("sample-note").hidden = !tasks.some(task => task.sample);
  $("board-footnote").textContent = storageAvailable ? "Your tasks stay in this browser." : "Temporary session. Export to keep your tasks.";
  $("today-date").textContent = new Date().toLocaleDateString("en", { month: "short", day: "numeric", weekday: "short" });
  const selected = selectTasks(tasks, { view, search: $("search").value, sort: $("sort-select").value });
  $("task-grid").replaceChildren(...selected.map(renderCard));
  $("empty-state").hidden = selected.length > 0;
  $("task-grid").hidden = selected.length === 0;
  if (!selected.length) {
    const searching = Boolean($("search").value.trim());
    $("empty-title").textContent = searching ? "That ghost is hiding." : view === "released" ? "A little peace is on its way." : "A beautifully quiet house.";
    $("empty-description").textContent = searching ? "Try a different word, or clear your search." : view === "released" ? "Finish a task on the haunting board and it will rest here." : "No unfinished business here. Enjoy the breathing room.";
    $("empty-add").hidden = searching || view === "released";
  }
  renderFocusOptions(active);
}

function renderFocusOptions(active) {
  const previousFocus = focusId;
  if (!active.some(task => task.id === focusId)) focusId = active[0]?.id || "";
  if (previousFocus && focusId !== previousFocus) resetTimer(false);
  $("focus-task").replaceChildren();
  if (!active.length) {
    const option = el("option", "", "No ghosts to focus on");
    option.value = "";
    $("focus-task").append(option);
  } else {
    for (const task of active) {
      const option = el("option", "", task.title);
      option.value = task.id;
      $("focus-task").append(option);
    }
  }
  $("focus-task").value = focusId;
  $("focus-task").disabled = !active.length || deadline !== null;
  $("timer-toggle").disabled = !active.length;
  $("release-focused").hidden = !timerFinished || !focusId;
  renderTimer();
}

function openTask(id = null) {
  closeMenus();
  const task = tasks.find(item => item.id === id);
  if (!task && tasks.length >= MAX_TASKS) {
    notify(`Your board can hold up to ${MAX_TASKS} tasks. Export and remove older ones first.`);
    return;
  }
  editingId = task?.id || null;
  $("task-form").reset();
  $("form-error").textContent = "";
  $("dialog-title").textContent = task ? "A little change of plans." : "A new little ghost.";
  $("save-task").textContent = task ? "Save changes" : "Give it a home +";
  if (task) {
    $("task-title").value = task.title;
    $("task-notes").value = task.notes;
    $("task-priority").value = task.priority;
    $("task-estimate").value = String(task.estimate);
    $("task-due").value = task.due;
    $("task-recurrence").value = task.recurrence ?? "none";
  }
  $("task-dialog").showModal();
  $("task-title").focus();
}

function saveTask(event) {
  event.preventDefault();
  try {
    const input = Object.fromEntries(new FormData($("task-form")));
    const old = tasks.find(task => task.id === editingId);
    if (editingId && !old) throw new Error("This task was removed in another tab. Close this form and create a new one.");
    if (!old && tasks.length >= MAX_TASKS) throw new Error("The board is full. Export and remove older tasks first.");
    const task = createTask(input, old ? new Date(old.createdAt) : new Date(), old?.id);
    if (old) {
      task.completedAt = old.completedAt;
      if (old.spawnedFrom) task.spawnedFrom = old.spawnedFrom;
      tasks = tasks.map(item => item.id === old.id ? task : item);
    } else {
      tasks.push(task);
      view = "active";
      $("search").value = "";
    }
    persist();
    $("task-dialog").close();
    render();
    notify(old ? "A fresh start for this little ghost." : "One less thing to carry in your head.");
  } catch (error) { $("form-error").textContent = error.message; }
}

function releaseTask(id, card = null) {
  const task = tasks.find(item => item.id === id);
  if (!task || task.completedAt) return;
  task.completedAt = new Date().toISOString();
  // Spawn the next occurrence for recurring tasks, if one doesn't already exist.
  const next = spawnNextTask(task, tasks);
  if (next) tasks.push(next);
  persist();
  if (focusId === id) resetTimer(false);
  const finish = () => {
    render();
    notify("One less haunting. Take a little breath.", () => restoreTask(id));
  };
  if (card && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    card.classList.add("is-leaving");
    setTimeout(finish, 450);
  } else finish();
}

function restoreTask(id) {
  const task = tasks.find(item => item.id === id);
  if (!task) return;
  task.completedAt = null;
  persist();
  render();
  notify("Back on the board. No judgment.");
}

function chooseFocus(id) {
  if (focusId !== id) resetTimer(false);
  focusId = id;
  renderFocusOptions(tasks.filter(task => !task.completedAt));
  const panel = document.querySelector(".focus-panel");
  panel.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
  $("timer-toggle").focus({ preventScroll: true });
  notify("Just this one thing. Start when you're ready.");
}

function saveTimer() {
  try { sessionStorage.setItem(TIMER_KEY, JSON.stringify({ focusId, duration, remaining, deadline, timerFinished })); }
  catch { /* Focus still works for this page when session storage is unavailable. */ }
}

function restoreTimer() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(TIMER_KEY) || "null");
    if (!saved || ![300, 900, 1500].includes(saved.duration) ||
        !Number.isFinite(saved.remaining) || saved.remaining < 0 || saved.remaining > saved.duration ||
        !(saved.deadline === null || Number.isFinite(saved.deadline)) ||
        !tasks.some(task => task.id === saved.focusId && !task.completedAt)) return;
    timerTaskBeforeRestore = saved.focusId;
    focusId = saved.focusId;
    duration = saved.duration;
    remaining = saved.deadline === null ? saved.remaining : Math.min(duration, remainingSeconds(saved.deadline));
    deadline = saved.deadline;
    timerFinished = saved.timerFinished === true || (deadline !== null && remaining === 0);
    if (timerFinished) deadline = null;
  } catch { /* A damaged timer never prevents access to tasks. */ }
}

function renderTimer() {
  $("timer-time").textContent = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  $("timer-face").style.setProperty("--timer-progress", `${(1 - remaining / duration) * 100}%`);
  $("timer-label").textContent = deadline !== null ? "just this one thing" : timerFinished ? "a small moment, well spent" : remaining < duration ? "a pause is okay, too" : "a little pocket of time";
  $("timer-toggle").textContent = deadline !== null ? "Pause for a moment" : timerFinished ? "Another little session \u2192" : remaining < duration ? "Keep going \u2192" : "Start a little focus \u2192";
  $("focus-task").disabled = !focusId || deadline !== null;
  for (const node of document.querySelectorAll("[data-duration]")) {
    const selected = Number(node.dataset.duration) * 60 === duration;
    node.classList.toggle("selected", selected);
    node.setAttribute("aria-pressed", String(selected));
    node.disabled = deadline !== null;
  }
  $("focus-result").textContent = timerFinished ? "Time's up. Take a breath. Did you finish your task?" : "";
  $("release-focused").hidden = !timerFinished || !focusId;
}

function resetTimer(announce = true) {
  deadline = null;
  remaining = duration;
  timerFinished = false;
  renderTimer();
  saveTimer();
  if (announce) notify("A fresh little pocket of time.");
}

function toggleTimer() {
  if (!focusId) return;
  if (deadline !== null) {
    remaining = remainingSeconds(deadline);
    deadline = null;
    if (!remaining) timerFinished = true;
  } else {
    if (timerFinished || !remaining) {
      remaining = duration;
      timerFinished = false;
    }
    deadline = Date.now() + remaining * 1000;
  }
  renderTimer();
  saveTimer();
}

function tick() {
  if (deadline !== null) {
    remaining = remainingSeconds(deadline);
    if (!remaining) {
      deadline = null;
      timerFinished = true;
      saveTimer();
      notify("Your focus time is up. A small moment, well spent.");
    }
    renderTimer();
  }
  if (dayKey() !== activeDay) {
    activeDay = dayKey();
    render();
  }
}

function showInfo(kind) {
  const content = $("info-content");
  content.replaceChildren();
  if (kind === "privacy") {
    $("info-title").textContent = "Your data, your business.";
    content.className = "privacy-copy";
    for (const text of [
      "GhostList stores task text in this browser's local storage. The application doesn't send your tasks to a server, use an AI API, or sync them between devices.",
      "Anyone using this same browser profile can see these tasks. Private browsing, clearing site data, or changing browsers can remove or hide them. Use Export to keep a JSON backup, and Import to add missing tasks back.",
      "Import keeps your current version of any task already on the board. Your focus session is saved only in this tab. The hosting provider may process ordinary connection and access logs.",
      "No account is needed for the standalone app. An access check may apply to a private hosted preview.",
    ]) content.append(el("p", "", text));
  } else {
    $("info-title").textContent = "A little guide.";
    content.className = "";
    for (const [heading, text] of [
      ["01 / Give it a home", "Write down one thing on your mind. Add a next step, a priority, or a date if it helps. Press N anytime you're not typing to add a task."],
      ["02 / Just this one thing", "Pick a ghost and try 5, 15, or 25 minutes of focus. Pause when you need to. The timer uses elapsed time, even if you switch tabs."],
      ["03 / Let it go", "Finish something? Release its ghost. It moves to At peace, where you can bring it back. There's no penalty for changing your plans."],
      ["04 / Keep what matters", "Your board saves in this browser. Export a backup whenever you want. The starter ghosts are sample tasks; Clear samples removes only those."],
    ]) {
      const step = el("div", "guide-step");
      step.append(el("h3", "", heading), el("p", "", text));
      content.append(step);
    }
  }
  $("info-dialog").showModal();
}

$("add-button").addEventListener("click", () => openTask());
$("empty-add").addEventListener("click", () => openTask());
$("task-form").addEventListener("submit", saveTask);
$("close-dialog").addEventListener("click", () => $("task-dialog").close());
$("cancel-task").addEventListener("click", () => $("task-dialog").close());
$("active-tab").addEventListener("click", () => { view = "active"; render(); });
$("released-tab").addEventListener("click", () => { view = "released"; render(); });
$("sort-select").addEventListener("change", render);
$("search").addEventListener("input", render);
$("how-button").addEventListener("click", () => showInfo("guide"));
$("privacy-button").addEventListener("click", () => showInfo("privacy"));
$("close-info").addEventListener("click", () => $("info-dialog").close());
$("info-done").addEventListener("click", () => $("info-dialog").close());
$("cancel-delete").addEventListener("click", () => $("delete-dialog").close());
$("confirm-delete").addEventListener("click", () => {
  const removed = tasks.find(task => task.id === pendingDelete);
  tasks = tasks.filter(task => task.id !== pendingDelete);
  persist();
  $("delete-dialog").close();
  render();
  if (removed) notify("Letting go is a kind of progress, too.", () => {
    if (tasks.some(task => task.id === removed.id)) return;
    if (tasks.length >= MAX_TASKS) { notify("The board is full. Remove a task before restoring this one."); return; }
    tasks.push(removed);
    persist();
    render();
    notify("Your task is back.");
  });
});
$("toast-undo").addEventListener("click", () => {
  const action = undoAction;
  undoAction = null;
  clearTimeout(toastTimeout);
  $("toast").classList.remove("visible");
  action?.();
});
$("remove-samples").addEventListener("click", () => {
  const removed = tasks.filter(task => task.sample);
  tasks = tasks.filter(task => !task.sample);
  persist();
  render();
  notify("A clean slate for your own little ghosts.", () => {
    try {
      tasks = mergeTasks(tasks, removed).tasks;
      persist();
      render();
      notify("The sample ghosts are back.");
    } catch (error) { notify(error.message); }
  });
});
$("focus-task").addEventListener("change", () => {
  focusId = $("focus-task").value;
  resetTimer(false);
});
$("timer-toggle").addEventListener("click", toggleTimer);
$("timer-reset").addEventListener("click", () => resetTimer());
$("release-focused").addEventListener("click", () => releaseTask(focusId));
document.querySelectorAll("[data-duration]").forEach(node => node.addEventListener("click", () => {
  duration = Number(node.dataset.duration) * 60;
  resetTimer(false);
}));
$("export-button").addEventListener("click", () => {
  const data = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tasks }, null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `ghostlist-${dayKey()}.json`;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify("Your little ghosts, packed for safekeeping.");
});
$("import-button").addEventListener("click", () => $("import-file").click());
$("import-file").addEventListener("change", async () => {
  const file = $("import-file").files[0];
  if (!file) return;
  try {
    if (file.size > 1500000) throw new Error("Choose a backup smaller than 1.5 MB.");
    const incoming = parseBackup(await file.text());
    const merged = mergeTasks(tasks, incoming);
    tasks = merged.tasks;
    persist();
    render();
    notify(`${merged.added} ${merged.added === 1 ? "ghost" : "ghosts"} added. Your current tasks stayed as they were.`);
  } catch (error) { notify(error.message); }
  $("import-file").value = "";
});
document.addEventListener("click", closeMenus);
document.addEventListener("keydown", event => {
  if (event.key === "Escape") closeMenus();
  if (event.key.toLowerCase() === "n" && !event.ctrlKey && !event.metaKey && !event.altKey &&
      !event.target.closest("input,textarea,select,[contenteditable=true]") &&
      !document.querySelector("dialog[open]")) {
    event.preventDefault();
    openTask();
  }
});
window.addEventListener("storage", event => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  try {
    tasks = event.newValue ? parseBackup(event.newValue) : [];
    render();
    notify("Your board was updated in another tab.");
  } catch { notify("An update from another tab couldn't be read. Your current board is unchanged."); }
});
window.addEventListener("pagehide", () => { if (deadline !== null) remaining = remainingSeconds(deadline); saveTimer(); });
document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });

loadTasks();
restoreTimer();
render();
if (timerTaskBeforeRestore) renderTimer();
setInterval(tick, 1000);
