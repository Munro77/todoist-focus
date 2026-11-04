import type { TodoistApi } from "../todoist/client";
import type { ApiItem, ApiProject, ApiSection, Command, Due, SyncResponse } from "../todoist/types";

/** In-memory stand-in for Todoist, for local development (`npm run dev:mock` or `?mock`). Invented data. */
export class MockApi implements TodoistApi {
  private items = new Map<string, ApiItem>();
  private projects: ApiProject[];
  private sections: ApiSection[];
  private done = new Map<string, ApiItem>();
  private seq = 0;

  constructor(now: Date = new Date()) {
    const day = (n: number) => {
      const d = new Date(now);
      d.setDate(d.getDate() + n);
      return d.toISOString().slice(0, 10);
    };
    const ago = (n: number) => new Date(now.getTime() - n * 86_400_000).toISOString();
    this.projects = [
      { id: "inbox", name: "Inbox", color: "charcoal", child_order: 0, inbox_project: true },
      { id: "p1", name: "01 - This Week", color: "berry_red", child_order: 1 },
      { id: "p2", name: "02 - Next Week", color: "red", child_order: 2 },
      { id: "p3", name: "03 - This Month", color: "orange", child_order: 3 },
      { id: "p4", name: "04 - Next Month", color: "olive_green", child_order: 4 },
      { id: "p5", name: "05 - Someday", color: "green", child_order: 5 },
    ];
    this.sections = [
      { id: "s1", project_id: "p5", name: "Finance", section_order: 1 },
      { id: "s2", project_id: "p5", name: "Books", section_order: 2 },
    ];
    const seed: [string, string, Partial<ApiItem>][] = [
      ["Sample: send quarterly report", "p2", { due: { date: day(-2), is_recurring: false }, priority: 3 }],
      ["Sample: review pull requests", "p1", { due: { date: day(0), is_recurring: false }, priority: 4 }],
      ["Sample: book dentist", "p1", { due: { date: day(1), is_recurring: false } }],
      ["Sample: draft team plan", "p1", { added_at: ago(40) }],
      ["Sample: tidy desk", "p1", { added_at: ago(2), priority: 2 }],
      ["Sample: rebalance savings", "p5", { section_id: "s1", due: { date: day(-12), string: "every 1st tuesday", is_recurring: true, lang: "en" }, added_at: ago(900) }],
      ["Sample: read a novel", "p5", { section_id: "s2", added_at: ago(400) }],
      ["Sample: plan weekend", "p3", {}],
      ["Sample: idea from a meeting", "inbox", { added_at: ago(0) }],
    ];
    for (const [content, project_id, extra] of seed) this.put({ content, project_id, priority: 1, added_at: ago(5), ...extra });
  }

  private put(partial: Omit<ApiItem, "id">): ApiItem {
    const it: ApiItem = { id: "t" + ++this.seq, labels: [], ...partial };
    this.items.set(it.id, it);
    return it;
  }

  async sync(_token: string, commands?: Command[]): Promise<SyncResponse> {
    const status: Record<string, "ok"> = {};
    for (const c of commands ?? []) {
      const a = c.args as Record<string, unknown>;
      const it = this.items.get(a.id as string);
      if (c.type === "item_move" && it) it.project_id = a.project_id as string;
      if (c.type === "item_update" && it) it.due = (a.due as Due | null) ?? null;
      if (c.type === "item_add") this.put({ content: a.content as string, project_id: (a.project_id as string) ?? "inbox", priority: 1, due: (a.due as Due) ?? null, added_at: new Date().toISOString() });
      if (c.type === "item_uncomplete") {
        const d = this.done.get(a.id as string);
        if (d) this.items.set(d.id, d);
      }
      status[c.uuid] = "ok";
    }
    await new Promise((r) => setTimeout(r, 150));
    return {
      full_sync: true,
      sync_token: "mock",
      items: [...this.items.values()].map((i) => ({ ...i })),
      projects: this.projects,
      sections: this.sections,
      sync_status: status,
    };
  }

  async closeTask(id: string): Promise<void> {
    const it = this.items.get(id);
    if (!it) return;
    if (it.due?.is_recurring) {
      const d = new Date(it.due.date + "T00:00:00");
      d.setDate(d.getDate() + 7);
      it.due = { ...it.due, date: d.toISOString().slice(0, 10) };
    } else {
      this.items.delete(id);
      this.done.set(id, it);
    }
  }
}
