import type { ApiError, Command, SyncResponse } from "./types";

const API = "https://api.todoist.com/api/v1/";
const RESOURCE_TYPES = JSON.stringify(["items", "projects", "sections"]);

/** What the app needs from Todoist. The real client and the mock both implement it. */
export interface TodoistApi {
  /** Fetch changes since `syncToken`, optionally running commands in the same request. */
  sync(syncToken: string, commands?: Command[]): Promise<SyncResponse>;
  /** Complete a task. Recurring tasks roll forward to their next date. */
  closeTask(id: string): Promise<void>;
}

export function newUuid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "x" + Date.now().toString(16) + Math.random().toString(16).slice(2);
}

/** Throws a `command` ApiError if any command in the batch was rejected. */
export function checkCommands(r: SyncResponse, commands?: Command[]): void {
  for (const c of commands ?? []) {
    const st = r.sync_status?.[c.uuid];
    if (st && st !== "ok") throw { code: "command", message: st.error ?? JSON.stringify(st) } satisfies ApiError;
  }
}

export class TodoistClient implements TodoistApi {
  constructor(
    private readonly token: string,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
  ) {}

  private async request<T>(path: string, init: { method?: string; form?: Record<string, string> } = {}): Promise<T | null> {
    const headers: Record<string, string> = { Authorization: "Bearer " + this.token };
    const body = init.form ? new URLSearchParams(init.form) : undefined;
    let res: Response;
    try {
      res = await this.fetchImpl(API + path, { method: init.method ?? "GET", headers, body });
    } catch (e) {
      throw { code: "network", message: (e as Error).message } satisfies ApiError;
    }
    if (res.status === 401 || res.status === 403) throw { code: "auth", status: res.status } satisfies ApiError;
    if (res.status === 429) {
      let retryAfter = 60;
      try {
        retryAfter = (await res.json())?.error_extra?.retry_after ?? 60;
      } catch {
        /* keep default */
      }
      throw { code: "rate_limited", status: 429, retryAfter } satisfies ApiError;
    }
    if (!res.ok) {
      let message = "";
      try {
        message = (await res.json())?.error ?? "";
      } catch {
        /* no body */
      }
      throw { code: "http", status: res.status, message } satisfies ApiError;
    }
    const text = await res.text();
    return text ? (JSON.parse(text) as T) : null;
  }

  async sync(syncToken: string, commands?: Command[]): Promise<SyncResponse> {
    const form: Record<string, string> = { sync_token: syncToken, resource_types: RESOURCE_TYPES };
    if (commands?.length) form.commands = JSON.stringify(commands);
    const r = (await this.request<SyncResponse>("sync", { method: "POST", form })) ?? {};
    checkCommands(r, commands);
    return r;
  }

  async closeTask(id: string): Promise<void> {
    await this.request("tasks/" + encodeURIComponent(id) + "/close", { method: "POST" });
  }
}
