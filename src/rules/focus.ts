import type { Rule } from "./engine";

/**
 * Today's Focus. Rules run top to bottom; a task shows in the first rule it matches.
 * Fields available on `f` are documented on `Fact` in ./engine.ts.
 */
export const FOCUS_RULES: Rule[] = [
  {
    label: "Overdue",
    explain: "Past their due date, any list.",
    where: (f) => f.overdueDays > 0,
    sort: "overdue",
    hideEmpty: true,
    hot: true,
  },
  {
    label: "Today & Tomorrow",
    explain: "Due today or tomorrow.",
    where: (f) => f.dueIn === 0 || f.dueIn === 1,
  },
  {
    label: "This Week",
    explain: "Everything else in This Week. Drifting tasks (3+ weeks old) first: do it, move it or drop it.",
    where: (f) => f.list === "this week",
    sort: "drift",
    driftDays: 21,
  },
];
