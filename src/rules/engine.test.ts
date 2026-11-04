import { describe, expect, it } from "vitest";
import type { Project, Task } from "../todoist/types";
import { applyRules, enrich, listKey } from "./engine";
import { FOCUS_RULES } from "./focus";

const NOW = new Date(2026, 10, 4, 10, 0, 0); // Wed 4 Nov 2026, local time

const projects: Record<string, Project> = {
  in: { id: "in", name: "Inbox", color: "charcoal", childOrder: 0, inboxProject: true },
  w1: { id: "w1", name: "01 - This Week", color: "berry_red", childOrder: 1, inboxProject: false },
  w2: { id: "w2", name: "02 - Next Week", color: "red", childOrder: 2, inboxProject: false },
  sd: { id: "sd", name: "05 - Someday", color: "green", childOrder: 5, inboxProject: false },
};

function task(id: string, over: Partial<Task> = {}): Task {
  return {
    id,
    content: id,
    description: "",
    projectId: "w1",
    priority: "p4",
    recurring: false,
    labels: [],
    addedAt: "2026-11-03T12:00:00Z",
    due: null,
    ...over,
  };
}

const ids = (g: { facts: { task: Task }[] }) => g.facts.map((f) => f.task.id);

describe("listKey", () => {
  it("strips the number prefix and lowercases", () => {
    expect(listKey(projects.w1)).toBe("this week");
    expect(listKey(projects.sd)).toBe("someday");
  });
  it("calls the inbox project inbox", () => {
    expect(listKey(projects.in)).toBe("inbox");
  });
});

describe("enrich", () => {
  it("computes due offsets from the local date", () => {
    expect(enrich(task("a", { dueDate: "2026-11-04" }), projects.w1, NOW).dueIn).toBe(0);
    expect(enrich(task("a", { dueDate: "2026-11-05" }), projects.w1, NOW).dueIn).toBe(1);
    const late = enrich(task("a", { dueDate: "2026-11-01" }), projects.w1, NOW);
    expect(late.dueIn).toBe(-3);
    expect(late.overdueDays).toBe(3);
  });
  it("ignores the time part of a due datetime", () => {
    expect(enrich(task("a", { dueDate: "2026-11-04T17:00:00" }), projects.w1, NOW).dueIn).toBe(0);
  });
  it("maps p1 to priority 1", () => {
    expect(enrich(task("a", { priority: "p1" }), projects.w1, NOW).priority).toBe(1);
  });
});

describe("FOCUS_RULES", () => {
  const tasks = [
    task("overdue-someday", { projectId: "sd", dueDate: "2026-10-06", recurring: "every 1st tuesday" }),
    task("overdue-nextweek", { projectId: "w2", dueDate: "2026-11-01" }),
    task("tomorrow-thisweek", { projectId: "w1", dueDate: "2026-11-05" }),
    task("drifting", { projectId: "w1", addedAt: "2026-09-10T00:00:00Z" }),
    task("fresh", { projectId: "w1", addedAt: "2026-11-03T00:00:00Z", priority: "p1" }),
    task("inbox", { projectId: "in" }),
    task("later", { projectId: "w2", dueDate: "2026-11-20" }),
  ];
  const [overdue, soon, week] = applyRules(tasks, projects, FOCUS_RULES, NOW);

  it("puts overdue tasks from any list first, most overdue on top", () => {
    expect(ids(overdue)).toEqual(["overdue-someday", "overdue-nextweek"]);
  });
  it("shows today and tomorrow next", () => {
    expect(ids(soon)).toEqual(["tomorrow-thisweek"]);
  });
  it("lists the rest of This Week with drifting tasks first", () => {
    expect(ids(week)).toEqual(["drifting", "fresh"]);
  });
  it("never shows a task twice", () => {
    const all = [overdue, soon, week].flatMap(ids);
    expect(new Set(all).size).toBe(all.length);
  });
  it("leaves out inbox and far-off tasks", () => {
    const all = [overdue, soon, week].flatMap(ids);
    expect(all).not.toContain("inbox");
    expect(all).not.toContain("later");
  });
});

describe("limit", () => {
  it("caps a group and reports how many were cut", () => {
    const tasks = ["a", "b", "c"].map((id) => task(id));
    const [g] = applyRules(tasks, projects, [{ label: "x", explain: "", where: () => true, limit: 2 }], NOW);
    expect(g.facts).toHaveLength(2);
    expect(g.hiddenByLimit).toBe(1);
  });
});
