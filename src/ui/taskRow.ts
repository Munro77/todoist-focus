import type { Project, Task } from "../todoist/types";
import { ageText, dayDiff, daysSince, shortDate, todayStr } from "../util/dates";
import { taskUrl } from "../todoist/links";
import { dot, el, popout } from "./dom";

export interface RowActions {
  complete(t: Task, row: HTMLElement): void;
  move(t: Task, projectId: string, row: HTMLElement): void;
  setDue(t: Task, day: string): void;
}

export interface RowOptions {
  /** Add a chip naming the task's list (used in Today's Focus). */
  project?: Project;
  /** Show an amber age chip when the task is older than this many days. */
  staleAfter?: number;
  /** Always show the task's age. */
  showAge?: boolean;
  /** Highlight as drifting with a do/move/drop note. */
  drifting?: boolean;
}

const CHECK_SVG =
  '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 6.5l2.5 2.5L10 3.5"/></svg>';

export function taskRow(t: Task, projects: Project[], actions: RowActions, opts: RowOptions = {}): HTMLLIElement {
  const li = el("li", "task");
  li.dataset.id = t.id;

  const check = el("button", "check");
  check.type = "button";
  check.dataset.p = t.priority;
  check.innerHTML = CHECK_SVG;
  check.setAttribute("aria-label", "Complete: " + t.content);
  check.addEventListener("click", () => actions.complete(t, li));

  const body = el("div", "body");
  const content = el("div", "content");
  content.append(el("span", null, t.content), popout(taskUrl(t.id), "task “" + t.content + "”"));
  body.appendChild(content);

  const meta = el("div", "meta");
  if (t.dueDate) {
    const d = t.dueDate.slice(0, 10);
    const diff = dayDiff(d, todayStr());
    if (diff < 0) meta.appendChild(el("span", "chip over", -diff + "d overdue"));
    else if (diff === 0) meta.appendChild(el("span", "chip today", "Today"));
    else meta.appendChild(el("span", "chip", diff === 1 ? "Tomorrow" : shortDate(d)));
  }
  if (t.recurring) meta.appendChild(el("span", "chip", "↻ " + t.recurring));
  for (const l of t.labels) meta.appendChild(el("span", "chip label", "@" + l));
  if (opts.project) {
    const c = el("span", "chip");
    c.append(dot(opts.project.color), opts.project.name);
    meta.appendChild(c);
  }
  const age = daysSince(t.addedAt);
  if (t.addedAt && !opts.drifting) {
    if (opts.staleAfter != null && age > opts.staleAfter && !t.recurring) meta.appendChild(el("span", "chip stale", ageText(age) + " old"));
    else if (opts.showAge) meta.appendChild(el("span", "chip", ageText(age) + " old"));
  }
  if (meta.childElementCount) body.appendChild(meta);
  if (opts.drifting) {
    li.classList.add("drifting");
    body.appendChild(el("div", "drift-note", "Drifting · added " + ageText(age) + " ago. Do it, move it or drop it."));
  }

  const due = el("input", "due");
  due.type = "date";
  due.id = "due-" + t.id;
  due.value = t.dueDate ? t.dueDate.slice(0, 10) : "";
  due.title = "Due date";
  due.setAttribute("aria-label", "Due date for " + t.content);
  // iOS fires change while the wheel spins; wait for it to settle.
  let settle = 0;
  due.addEventListener("change", () => {
    clearTimeout(settle);
    settle = window.setTimeout(() => actions.setDue(t, due.value), 700);
  });

  const move = el("select", "move");
  move.id = "mv-" + t.id;
  move.setAttribute("aria-label", "Move " + t.content);
  move.appendChild(new Option("Move to…", ""));
  for (const p of projects) if (p.id !== t.projectId) move.appendChild(new Option(p.name, p.id));
  move.addEventListener("change", () => move.value && actions.move(t, move.value, li));

  const side = el("div", "actions");
  side.append(due, move);
  li.append(check, body, side);
  return li;
}
