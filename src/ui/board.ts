import { applyRules, isDrifting, type Rule } from "../rules/engine";
import type { Project, Section, Task } from "../todoist/types";
import { todayStr } from "../util/dates";
import { $, colorOf, dot, el } from "./dom";
import { taskRow, type RowActions } from "./taskRow";

export interface BoardView {
  projects: Project[];
  tasks: Task[];
  sections: Record<string, Section[]>;
  rules: Rule[];
  query: string;
  updatedAt: number | null;
  error: string | null;
}

const PRI_RANK = { p1: 0, p2: 1, p3: 2, p4: 3 } as const;
const openFolds = new Set<string>();

function matches(t: Task, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  return t.content.toLowerCase().includes(s) || t.description.toLowerCase().includes(s) || t.labels.some((l) => l.toLowerCase().includes(s));
}

/** Lane order: overdue/today first, then priority, then date, then oldest. */
function laneSort(list: Task[]): Task[] {
  const today = todayStr();
  return list.slice().sort((a, b) => {
    const ad = a.dueDate?.slice(0, 10) ?? null, bd = b.dueDate?.slice(0, 10) ?? null;
    const ao = ad && ad <= today ? 0 : 1, bo = bd && bd <= today ? 0 : 1;
    if (ao !== bo) return ao - bo;
    const pr = PRI_RANK[a.priority] - PRI_RANK[b.priority];
    if (pr) return pr;
    if (ad && bd && ad !== bd) return ad < bd ? -1 : 1;
    if (ad && !bd) return -1;
    if (bd && !ad) return 1;
    return (a.addedAt ?? "") < (b.addedAt ?? "") ? -1 : 1;
  });
}

const isSomeday = (p: Project) => /someday|maybe/i.test(p.name);

export function drawBoard(v: BoardView, actions: RowActions): void {
  const byId = Object.fromEntries(v.projects.map((p) => [p.id, p]));
  const shown = v.tasks.filter((t) => matches(t, v.query));
  const byProject: Record<string, Task[]> = {};
  for (const t of shown) (byProject[t.projectId] ??= []).push(t);

  drawAddPicker(v.projects);
  drawSummary(v);

  // Today's Focus
  const focus = $("focus-body");
  if (v.projects.length) {
    focus.replaceChildren();
    let total = 0;
    for (const g of applyRules(v.tasks, byId, v.rules)) {
      const facts = g.facts.filter((f) => matches(f.task, v.query));
      total += facts.length;
      if (g.rule.hideEmpty && !facts.length) continue;
      const col = el("div", "fgroup" + (g.rule.hot && facts.length ? " hot" : ""));
      const label = el("div", "group-label");
      label.append(el("span", null, g.rule.label), el("span", "mono", String(facts.length)));
      col.append(label, el("div", "rule", g.rule.explain));
      if (!facts.length) col.appendChild(el("div", "empty", v.query ? "No matches." : "Clear."));
      else {
        const ul = el("ul", "tasks");
        for (const f of facts) ul.appendChild(taskRow(f.task, v.projects, actions, { project: byId[f.task.projectId], drifting: isDrifting(f, g.rule) }));
        col.appendChild(ul);
      }
      if (g.hiddenByLimit) col.appendChild(el("div", "note", `+${g.hiddenByLimit} more not shown (capped at ${g.rule.limit})`));
      focus.appendChild(col);
    }
    $("focus-count").textContent = String(total);
  }

  // Lanes
  const lanes = $("lanes"), folded = $("folded");
  lanes.replaceChildren();
  folded.replaceChildren();
  v.projects.forEach((p, i) => {
    const list = laneSort(byProject[p.id] ?? []);
    const someday = isSomeday(p);
    const head = el("div", "panel-head");
    const h = el("h2");
    const sw = el("span", "swatch");
    sw.style.background = colorOf(p.color);
    h.append(sw, p.name);
    const count = el("span", "count mono", String(list.length));
    head.append(h, count);

    const body = el("div");
    const rowOpts = { staleAfter: someday ? undefined : i <= 1 ? 21 : 45, showAge: someday };
    if (!list.length) body.appendChild(el("div", "empty", v.query ? "No matches." : "Clear."));
    else {
      const secs = v.sections[p.id] ?? [];
      const groups = new Map<string, Task[]>([["", []]]);
      for (const s of secs) groups.set(s.id, []);
      for (const t of list) groups.get(t.sectionId && groups.has(t.sectionId) ? t.sectionId : "")!.push(t);
      for (const [sid, ts] of groups) {
        if (!ts.length) continue;
        const name = sid ? secs.find((s) => s.id === sid)?.name ?? "Section" : secs.length ? "No section" : "";
        if (name) body.appendChild(el("div", "group-label", `${name} · ${ts.length}`));
        const ul = el("ul", "tasks");
        for (const t of ts) ul.appendChild(taskRow(t, v.projects, actions, rowOpts));
        body.appendChild(ul);
      }
    }

    if (someday) {
      const d = el("details", "panel");
      d.open = !!v.query || openFolds.has(p.id);
      const s = el("summary");
      const mark = () => (count.textContent = list.length + (d.open ? "  ▾" : "  ▸"));
      mark();
      d.addEventListener("toggle", () => {
        if (!v.query) d.open ? openFolds.add(p.id) : openFolds.delete(p.id);
        mark();
      });
      s.appendChild(head);
      d.append(s, body);
      folded.appendChild(d);
    } else {
      const sec = el("section", "panel");
      sec.append(head, body);
      lanes.appendChild(sec);
    }
  });

  const banner = $("banner");
  banner.hidden = !v.error;
  banner.textContent = v.error ?? "";
}

function drawSummary(v: BoardView): void {
  const strip = $("strip"), legend = $("legend");
  strip.replaceChildren();
  legend.replaceChildren();
  for (const p of v.projects) {
    const n = v.tasks.filter((t) => t.projectId === p.id).length;
    const seg = el("span");
    seg.style.flex = String(Math.max(n, 0.3));
    seg.style.background = colorOf(p.color);
    seg.title = `${p.name}: ${n}`;
    strip.appendChild(seg);
    const item = el("span");
    item.append(dot(p.color), p.name + " ", el("b", "mono", String(n)));
    legend.appendChild(item);
  }
  $("fresh").textContent = v.updatedAt
    ? "Updated " + new Date(v.updatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : "";
}

/** Keep the add bar's list picker in step with the projects, preserving the current choice. */
function drawAddPicker(projects: Project[]): void {
  const sel = $<HTMLSelectElement>("new-proj");
  const sig = projects.map((p) => p.id + p.name).join("|");
  if (!projects.length || sel.dataset.sig === sig) return;
  const keep = sel.value;
  sel.replaceChildren(...projects.map((p) => new Option(p.name, p.id)));
  const inbox = projects.find((p) => p.inboxProject)?.id ?? projects[0].id;
  sel.value = [...sel.options].some((o) => o.value === keep) ? keep : inbox;
  sel.dataset.sig = sig;
}
