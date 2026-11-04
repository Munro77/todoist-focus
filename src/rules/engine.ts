import type { Project, Task } from "../todoist/types";
import { dayDiff, daysSince, todayStr } from "../util/dates";

/** Everything a rule can look at for one task. */
export interface Fact {
  task: Task;
  /** List name without its number, lowercase: "this week", "inbox". */
  list: string;
  /** Due day (YYYY-MM-DD) or null. */
  due: string | null;
  /** Days until due: 0 today, 1 tomorrow, negative if past. null if undated. */
  dueIn: number | null;
  /** Days past due, 0 if not overdue. */
  overdueDays: number;
  /** Days since the task was created. */
  ageDays: number;
  recurring: boolean;
  /** 1 (highest) to 4. */
  priority: number;
  /** Blend of priority, lateness and age. Higher = more pressing. */
  score: number;
}

export type SortKey = "due" | "overdue" | "age" | "score" | "drift";

export interface Rule {
  label: string;
  /** One line shown under the label explaining the rule. */
  explain: string;
  where: (f: Fact) => boolean;
  sort?: SortKey;
  /** Show at most this many. */
  limit?: number;
  /** Hide the whole group when nothing matches. */
  hideEmpty?: boolean;
  /** Style the group as urgent when it has tasks. */
  hot?: boolean;
  /** For sort "drift": tasks older than this float to the top and get a note. */
  driftDays?: number;
}

export interface GroupResult {
  rule: Rule;
  facts: Fact[];
  /** How many matched but were cut by `limit`. */
  hiddenByLimit: number;
}

const PRIORITY_NUM: Record<Task["priority"], number> = { p1: 1, p2: 2, p3: 3, p4: 4 };

/** "01 - This Week" -> "this week"; the Inbox project is always "inbox". */
export function listKey(p: Project | undefined): string {
  if (!p) return "";
  if (p.inboxProject) return "inbox";
  return p.name.replace(/^\s*\d+\s*-\s*/, "").trim().toLowerCase();
}

export function score(priority: number, overdueDays: number, ageDays: number, dueIn: number | null): number {
  return (
    (5 - priority) * 10 +
    Math.min(overdueDays, 30) * 1.5 +
    Math.min(ageDays, 90) / 9 +
    (dueIn !== null && dueIn >= 0 && dueIn <= 2 ? 8 : 0)
  );
}

export function enrich(task: Task, project: Project | undefined, now: Date = new Date()): Fact {
  const due = task.dueDate ? task.dueDate.slice(0, 10) : null;
  const dueIn = due ? dayDiff(due, todayStr(now)) : null;
  const overdueDays = dueIn !== null && dueIn < 0 ? -dueIn : 0;
  const ageDays = daysSince(task.addedAt, now);
  const priority = PRIORITY_NUM[task.priority];
  return {
    task,
    list: listKey(project),
    due,
    dueIn,
    overdueDays,
    ageDays,
    recurring: !!task.recurring,
    priority,
    score: score(priority, overdueDays, ageDays, dueIn),
  };
}

export const DEFAULT_DRIFT_DAYS = 21;

export function isDrifting(f: Fact, rule: Rule): boolean {
  return rule.sort === "drift" && !f.recurring && f.ageDays > (rule.driftDays ?? DEFAULT_DRIFT_DAYS);
}

export function sortFacts(list: Fact[], rule: Rule): Fact[] {
  const out = list.slice();
  switch (rule.sort) {
    case "overdue":
      return out.sort((a, b) => b.overdueDays - a.overdueDays || a.priority - b.priority);
    case "age":
      return out.sort((a, b) => b.ageDays - a.ageDays);
    case "score":
      return out.sort((a, b) => b.score - a.score);
    case "drift":
      return out.sort((a, b) => {
        const da = isDrifting(a, rule), db = isDrifting(b, rule);
        if (da !== db) return da ? -1 : 1;
        return da ? b.ageDays - a.ageDays : b.score - a.score;
      });
    default:
      return out.sort((a, b) => (a.dueIn ?? 999) - (b.dueIn ?? 999) || a.priority - b.priority);
  }
}

/** Run rules in order. A task lands in the first rule it matches and nowhere else. */
export function applyRules(
  tasks: Task[],
  projectsById: Record<string, Project>,
  rules: Rule[],
  now: Date = new Date(),
): GroupResult[] {
  const facts = tasks.map((t) => enrich(t, projectsById[t.projectId], now));
  const taken = new Set<string>();
  return rules.map((rule) => {
    let matched = sortFacts(
      facts.filter((f) => !taken.has(f.task.id) && rule.where(f)),
      rule,
    );
    const hiddenByLimit = rule.limit && matched.length > rule.limit ? matched.length - rule.limit : 0;
    if (rule.limit) matched = matched.slice(0, rule.limit);
    matched.forEach((f) => taken.add(f.task.id));
    return { rule, facts: matched, hiddenByLimit };
  });
}
