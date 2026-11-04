import type { Rule } from "./rules/engine";
import type { TodoistApi } from "./todoist/client";
import * as cmd from "./todoist/commands";
import { Store, type StoreSnapshot } from "./todoist/store";
import { isApiError, type ApiError, type Task } from "./todoist/types";
import { drawBoard } from "./ui/board";
import { toast } from "./ui/toast";
import { shortDate } from "./util/dates";

const POLL_MS = 60_000;

export function errorText(e: unknown): string {
  if (!isApiError(e)) return "Something went wrong: " + String(e);
  switch (e.code) {
    case "auth":
      return "Todoist didn't accept your API token. Paste a fresh one from Todoist Settings → Integrations → Developer.";
    case "network":
      return "Couldn't reach Todoist. Check your connection; the board will retry.";
    case "rate_limited":
      return `Todoist asked us to slow down. Trying again in ${e.retryAfter ?? 60}s.`;
    case "command":
      return "Todoist refused that change" + (e.message ? ": " + e.message : ".");
    default:
      return "Todoist returned an error" + (e.status ? ` (${e.status})` : "") + (e.message ? ": " + e.message : ".");
  }
}

/** For writes: a network or 5xx failure doesn't prove the change didn't happen. */
function unsure(e: unknown, what: string): string {
  const ambiguous = isApiError(e) && (e.code === "network" || (e.code === "http" && (e.status ?? 0) >= 500));
  return ambiguous ? `Todoist didn't confirm ${what}. Hit Refresh to check.` : errorText(e);
}

export interface AppOptions {
  api: TodoistApi;
  rules: Rule[];
  /** localStorage key for the offline cache; null disables caching (mock mode). */
  cacheKey: string | null;
  onAuthError(message: string): void;
}

export class App {
  readonly store = new Store();
  private query = "";
  private readonly hidden = new Set<string>(); // completed, waiting for sync to confirm
  private readonly moved = new Map<string, string>(); // task id -> project id, waiting for sync
  private error: string | null = null;
  private updatedAt: number | null = null;
  private inflight: Promise<void> | null = null;
  private pollTimer = 0;
  private frame = 0;

  constructor(private readonly opts: AppOptions) {}

  // ----- lifecycle -----

  start(): void {
    this.loadCache();
    void this.refresh();
    this.schedulePoll();
    document.addEventListener("visibilitychange", this.onVisible);
  }

  stop(): void {
    clearTimeout(this.pollTimer);
    document.removeEventListener("visibilitychange", this.onVisible);
  }

  private onVisible = () => {
    if (document.visibilityState === "visible") void this.refresh();
  };

  private schedulePoll(ms = POLL_MS): void {
    clearTimeout(this.pollTimer);
    this.pollTimer = window.setTimeout(async () => {
      if (document.visibilityState === "visible") await this.refresh();
      this.schedulePoll();
    }, ms);
  }

  setQuery(q: string): void {
    this.query = q;
    this.render();
  }

  // ----- sync -----

  /** Pull changes (and push commands, if any). Errors are thrown for commands, shown for plain refreshes. */
  private async sync(commands?: Parameters<TodoistApi["sync"]>[1]): Promise<void> {
    const r = await this.opts.api.sync(this.store.syncToken, commands);
    this.store.apply(r);
    for (const [id, pid] of this.moved) {
      const it = this.store.items.get(id);
      if (!it || it.project_id === pid) this.moved.delete(id);
    }
    for (const id of [...this.hidden]) if (!this.store.items.has(id)) this.hidden.delete(id);
    this.error = null;
    this.updatedAt = Date.now();
    this.saveCache();
    this.render();
  }

  refresh = async (): Promise<void> => {
    if (this.inflight) return this.inflight;
    this.inflight = this.sync()
      .catch((e: unknown) => {
        this.error = errorText(e);
        this.render();
        if (isApiError(e) && e.code === "auth") this.opts.onAuthError(this.error);
        if (isApiError(e) && e.code === "rate_limited") this.schedulePoll((e.retryAfter ?? 60) * 1000);
      })
      .finally(() => (this.inflight = null));
    return this.inflight;
  };

  private loadCache(): void {
    if (!this.opts.cacheKey) return;
    try {
      const raw = localStorage.getItem(this.opts.cacheKey);
      if (!raw) return;
      const c = JSON.parse(raw) as StoreSnapshot & { t: number };
      this.store.restore(c);
      this.updatedAt = c.t;
      this.render();
    } catch {
      /* ignore a bad cache */
    }
  }

  private saveCache(): void {
    if (!this.opts.cacheKey) return;
    try {
      localStorage.setItem(this.opts.cacheKey, JSON.stringify({ t: Date.now(), ...this.store.snapshot() }));
    } catch {
      /* storage full or blocked */
    }
  }

  // ----- render -----

  render(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      // Don't rebuild rows while a picker in one of them is open.
      const a = document.activeElement;
      if (a instanceof HTMLElement && (a.classList.contains("move") || a.classList.contains("due"))) {
        setTimeout(() => this.render(), 400);
        return;
      }
      drawBoard(
        {
          projects: this.store.projectList(),
          tasks: this.visibleTasks(),
          sections: this.store.sectionsByProject(),
          rules: this.opts.rules,
          query: this.query,
          updatedAt: this.updatedAt,
          error: this.error,
        },
        { complete: this.complete, move: this.move, setDue: this.setDue },
      );
    });
  }

  /** Store tasks with in-flight completions hidden and in-flight moves applied. */
  private visibleTasks(): Task[] {
    return this.store
      .tasks()
      .filter((t) => !this.hidden.has(t.id))
      .map((t) => {
        const to = this.moved.get(t.id);
        return to && to !== t.projectId ? { ...t, projectId: to, sectionId: undefined } : t;
      });
  }

  // ----- actions -----

  complete = async (t: Task, row: HTMLElement): Promise<void> => {
    row.classList.add("leaving");
    this.hidden.add(t.id);
    setTimeout(() => this.render(), 220);
    try {
      await this.opts.api.closeTask(t.id);
      if (t.recurring) {
        this.hidden.delete(t.id);
        toast(`Done. Next one is scheduled (${t.recurring}).`);
      } else toast(`Completed “${t.content}”`, () => void this.reopen(t));
      await this.refresh();
    } catch (e) {
      this.hidden.delete(t.id);
      this.render();
      toast(unsure(e, "the completion"));
    }
  };

  private async reopen(t: Task): Promise<void> {
    try {
      await this.sync([cmd.uncompleteTask(t.id)]);
      toast(`Reopened “${t.content}”`);
    } catch (e) {
      toast(errorText(e));
    }
  }

  move = async (t: Task, projectId: string, row: HTMLElement): Promise<void> => {
    const from = this.store.items.get(t.id)?.project_id ?? t.projectId;
    const dest = this.store.projects.get(projectId)?.name ?? "list";
    row.classList.add("leaving");
    this.moved.set(t.id, projectId);
    (document.activeElement as HTMLElement | null)?.blur();
    setTimeout(() => this.render(), 200);
    try {
      await this.sync([cmd.moveTask(t.id, projectId)]);
      toast("Moved to " + dest, async () => {
        this.moved.set(t.id, from);
        this.render();
        try {
          await this.sync([cmd.moveTask(t.id, from)]);
        } catch (e) {
          toast(errorText(e));
        }
      });
    } catch (e) {
      this.moved.delete(t.id);
      this.render();
      toast(unsure(e, "the move"));
    }
  };

  setDue = async (t: Task, day: string): Promise<void> => {
    const had = t.dueDate?.slice(0, 10) ?? "";
    if (day === had) return;
    try {
      await this.sync([cmd.setDue(t.id, this.store.items.get(t.id)?.due, day)]);
      toast(day ? "Due " + shortDate(day) : "Due date removed" + (t.recurring ? " (this also stops it repeating)" : ""));
      (document.activeElement as HTMLElement | null)?.blur();
    } catch (e) {
      this.render();
      toast(unsure(e, "the date"));
    }
  };

  addTask = async (title: string, projectId: string, day: string): Promise<boolean> => {
    try {
      await this.sync([cmd.addTask(title, projectId || this.store.inboxId(), day || undefined)]);
      const dest = this.store.projects.get(projectId)?.name ?? "Inbox";
      toast("Added to " + dest + (day ? ", due " + shortDate(day, false) : ""));
      return true;
    } catch (e) {
      toast(unsure(e, "the new task") + (isApiError(e) && (e as ApiError).code === "network" ? " Check before adding it again." : ""));
      return false;
    }
  };

  /** Connect with a new token: full sync, throws on failure. */
  async connect(): Promise<void> {
    this.store.reset();
    await this.sync();
  }

  clear(): void {
    this.stop();
    this.store.reset();
    if (this.opts.cacheKey) localStorage.removeItem(this.opts.cacheKey);
    this.render();
  }
}
