// Shapes returned by the Todoist API v1 (snake_case, as sent on the wire).

export interface Due {
  date: string; // "YYYY-MM-DD" or "YYYY-MM-DDTHH:MM:SS"
  string?: string; // human text, e.g. "every 1st tuesday"
  is_recurring: boolean;
  lang?: string;
  timezone?: string | null;
  datetime?: string | null;
}

export interface ApiItem {
  id: string;
  content: string;
  description?: string;
  project_id: string;
  section_id?: string | null;
  parent_id?: string | null;
  priority: number; // 4 = p1 (highest) ... 1 = p4
  due?: Due | null;
  labels?: string[];
  added_at?: string;
  checked?: boolean;
  is_deleted?: boolean;
}

export interface ApiProject {
  id: string;
  name: string;
  color: string;
  child_order: number;
  inbox_project?: boolean;
  is_archived?: boolean;
  is_deleted?: boolean;
}

export interface ApiSection {
  id: string;
  project_id: string;
  name: string;
  section_order: number;
  is_archived?: boolean;
  is_deleted?: boolean;
}

export type CommandStatus = "ok" | { error?: string; error_code?: number };

export interface SyncResponse {
  full_sync?: boolean;
  sync_token?: string;
  items?: ApiItem[];
  projects?: ApiProject[];
  sections?: ApiSection[];
  sync_status?: Record<string, CommandStatus>;
}

export interface Command {
  type: string;
  uuid: string;
  temp_id?: string;
  args: Record<string, unknown>;
}

// Normalized shapes the UI and rules work with.

export type Priority = "p1" | "p2" | "p3" | "p4";

export interface Task {
  id: string;
  content: string;
  description: string;
  projectId: string;
  sectionId?: string;
  parentId?: string;
  priority: Priority;
  dueDate?: string; // as Todoist sends it; slice(0, 10) for the day
  recurring: string | false; // recurrence text, or false
  labels: string[];
  addedAt?: string;
  due: Due | null;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  childOrder: number;
  inboxProject: boolean;
}

export interface Section {
  id: string;
  projectId: string;
  name: string;
  sectionOrder: number;
}

export type ApiErrorCode = "auth" | "network" | "rate_limited" | "command" | "http";

export interface ApiError {
  code: ApiErrorCode;
  status?: number;
  message?: string;
  retryAfter?: number; // seconds
}

export function isApiError(e: unknown): e is ApiError {
  return typeof e === "object" && e !== null && "code" in e;
}
