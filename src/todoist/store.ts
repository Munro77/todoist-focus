import type { ApiItem, ApiProject, ApiSection, Priority, Project, Section, SyncResponse, Task } from "./types";

const API_PRIORITY: Record<number, Priority> = { 4: "p1", 3: "p2", 2: "p3", 1: "p4" };

export function toTask(it: ApiItem): Task {
  return {
    id: it.id,
    content: it.content,
    description: it.description ?? "",
    projectId: it.project_id,
    sectionId: it.section_id ?? undefined,
    parentId: it.parent_id ?? undefined,
    priority: API_PRIORITY[it.priority] ?? "p4",
    dueDate: it.due?.date ?? undefined,
    recurring: it.due?.is_recurring ? it.due.string || "repeats" : false,
    labels: it.labels ?? [],
    addedAt: it.added_at,
    due: it.due ?? null,
  };
}

export interface StoreSnapshot {
  syncToken: string;
  items: ApiItem[];
  projects: ApiProject[];
  sections: ApiSection[];
}

/** Local mirror of the Todoist account, kept current by applying sync responses. */
export class Store {
  syncToken = "*";
  readonly items = new Map<string, ApiItem>();
  readonly projects = new Map<string, ApiProject>();
  readonly sections = new Map<string, ApiSection>();

  apply(r: SyncResponse): void {
    if (r.full_sync) {
      this.items.clear();
      this.projects.clear();
      this.sections.clear();
    }
    for (const it of r.items ?? []) {
      if (it.is_deleted || it.checked) this.items.delete(it.id);
      else this.items.set(it.id, it);
    }
    for (const p of r.projects ?? []) {
      if (p.is_deleted || p.is_archived) this.projects.delete(p.id);
      else this.projects.set(p.id, p);
    }
    for (const s of r.sections ?? []) {
      if (s.is_deleted || s.is_archived) this.sections.delete(s.id);
      else this.sections.set(s.id, s);
    }
    if (r.sync_token) this.syncToken = r.sync_token;
  }

  reset(): void {
    this.syncToken = "*";
    this.items.clear();
    this.projects.clear();
    this.sections.clear();
  }

  snapshot(): StoreSnapshot {
    return {
      syncToken: this.syncToken,
      items: [...this.items.values()],
      projects: [...this.projects.values()],
      sections: [...this.sections.values()],
    };
  }

  restore(s: StoreSnapshot): void {
    this.reset();
    this.syncToken = s.syncToken || "*";
    s.items.forEach((i) => this.items.set(i.id, i));
    s.projects.forEach((p) => this.projects.set(p.id, p));
    s.sections.forEach((x) => this.sections.set(x.id, x));
  }

  tasks(): Task[] {
    return [...this.items.values()].map(toTask);
  }

  /** Projects in sidebar order, Inbox first. */
  projectList(): Project[] {
    return [...this.projects.values()]
      .map((p) => ({ id: p.id, name: p.name, color: p.color, childOrder: p.child_order, inboxProject: !!p.inbox_project }))
      .sort((a, b) => Number(b.inboxProject) - Number(a.inboxProject) || a.childOrder - b.childOrder);
  }

  sectionsByProject(): Record<string, Section[]> {
    const out: Record<string, Section[]> = {};
    for (const s of this.sections.values()) {
      (out[s.project_id] ??= []).push({ id: s.id, projectId: s.project_id, name: s.name, sectionOrder: s.section_order });
    }
    for (const k in out) out[k].sort((a, b) => a.sectionOrder - b.sectionOrder);
    return out;
  }

  inboxId(): string | undefined {
    for (const p of this.projects.values()) if (p.inbox_project) return p.id;
    return undefined;
  }
}
