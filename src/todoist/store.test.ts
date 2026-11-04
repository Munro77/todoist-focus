import { describe, expect, it } from "vitest";
import { nextDue } from "./commands";
import { Store, toTask } from "./store";
import type { ApiItem } from "./types";

const item = (id: string, over: Partial<ApiItem> = {}): ApiItem => ({
  id,
  content: id,
  project_id: "p",
  priority: 1,
  ...over,
});

describe("toTask", () => {
  it("maps API priority 4 to p1", () => {
    expect(toTask(item("a", { priority: 4 })).priority).toBe("p1");
    expect(toTask(item("a", { priority: 1 })).priority).toBe("p4");
  });
  it("exposes recurrence text only for recurring tasks", () => {
    expect(toTask(item("a", { due: { date: "2026-11-04", string: "every day", is_recurring: true } })).recurring).toBe("every day");
    expect(toTask(item("a", { due: { date: "2026-11-04", string: "Nov 4", is_recurring: false } })).recurring).toBe(false);
  });
});

describe("Store.apply", () => {
  it("replaces everything on a full sync", () => {
    const s = new Store();
    s.apply({ full_sync: true, sync_token: "t1", items: [item("a"), item("b")] });
    s.apply({ full_sync: true, sync_token: "t2", items: [item("c")] });
    expect([...s.items.keys()]).toEqual(["c"]);
    expect(s.syncToken).toBe("t2");
  });
  it("merges incremental changes and drops completed or deleted tasks", () => {
    const s = new Store();
    s.apply({ full_sync: true, sync_token: "t1", items: [item("a"), item("b"), item("c")] });
    s.apply({ sync_token: "t2", items: [item("a", { checked: true }), item("b", { is_deleted: true }), item("d")] });
    expect([...s.items.keys()].sort()).toEqual(["c", "d"]);
  });
  it("drops archived projects", () => {
    const s = new Store();
    s.apply({ full_sync: true, projects: [{ id: "p", name: "Old", color: "red", child_order: 1, is_archived: true }] });
    expect(s.projects.size).toBe(0);
  });
  it("orders projects with Inbox first", () => {
    const s = new Store();
    s.apply({
      full_sync: true,
      projects: [
        { id: "b", name: "02 - Next Week", color: "red", child_order: 2 },
        { id: "i", name: "Inbox", color: "charcoal", child_order: 0, inbox_project: true },
        { id: "a", name: "01 - This Week", color: "red", child_order: 1 },
      ],
    });
    expect(s.projectList().map((p) => p.id)).toEqual(["i", "a", "b"]);
    expect(s.inboxId()).toBe("i");
  });
});

describe("nextDue", () => {
  it("keeps recurrence when moving the date", () => {
    const d = nextDue({ date: "2026-10-06", string: "every 1st tuesday", is_recurring: true, lang: "en" }, "2026-11-10");
    expect(d).toEqual({ date: "2026-11-10", string: "every 1st tuesday", is_recurring: true, lang: "en" });
  });
  it("keeps the time of day", () => {
    expect(nextDue({ date: "2026-10-06T09:30:00", is_recurring: false }, "2026-11-10")?.date).toBe("2026-11-10T09:30:00");
  });
  it("returns null to clear the date", () => {
    expect(nextDue({ date: "2026-10-06", is_recurring: true }, "")).toBeNull();
  });
});
