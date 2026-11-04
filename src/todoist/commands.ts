import { newUuid } from "./client";
import type { Command, Due } from "./types";

export const moveTask = (id: string, projectId: string): Command => ({
  type: "item_move",
  uuid: newUuid(),
  args: { id, project_id: projectId },
});

export const uncompleteTask = (id: string): Command => ({
  type: "item_uncomplete",
  uuid: newUuid(),
  args: { id },
});

export const addTask = (content: string, projectId?: string, dueDate?: string): Command => {
  const args: Record<string, unknown> = { content };
  if (projectId) args.project_id = projectId;
  if (dueDate) args.due = { date: dueDate };
  return { type: "item_add", uuid: newUuid(), temp_id: newUuid(), args };
};

/**
 * The due object to send when changing a task's date.
 * Keeps the recurrence text and any time of day so only the date moves.
 * `newDate` empty means remove the date (which also ends any recurrence).
 */
export function nextDue(current: Due | null | undefined, newDate: string): Due | null {
  if (!newDate) return null;
  if (!current) return { date: newDate, is_recurring: false };
  const time = current.date && current.date.length > 10 ? current.date.slice(10) : "";
  return { ...current, date: newDate + time };
}

export const setDue = (id: string, current: Due | null | undefined, newDate: string): Command => {
  const due = nextDue(current, newDate);
  // A brand-new date only needs {date}; Todoist fills in the rest.
  const sent = due && !current ? { date: due.date } : due;
  return { type: "item_update", uuid: newUuid(), args: { id, due: sent } };
};
