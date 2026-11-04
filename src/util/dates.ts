const DAY = 86_400_000;

/** Local calendar date as YYYY-MM-DD. */
export function todayStr(now: Date = new Date()): string {
  return (
    now.getFullYear() +
    "-" +
    String(now.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(now.getDate()).padStart(2, "0")
  );
}

/** Whole days from b to a (a - b), both YYYY-MM-DD, using local midnight. */
export function dayDiff(a: string, b: string): number {
  return Math.round((new Date(a + "T00:00:00").getTime() - new Date(b + "T00:00:00").getTime()) / DAY);
}

export function daysSince(iso: string | undefined, now: Date = new Date()): number {
  if (!iso) return 0;
  return Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);
}

/** "12d", "3mo", "2.5y" */
export function ageText(days: number): string {
  if (days < 1) return "today";
  if (days < 60) return days + "d";
  if (days < 730) return Math.round(days / 30) + "mo";
  return (days / 365).toFixed(1).replace(/\.0$/, "") + "y";
}

export function shortDate(day: string, withWeekday = true): string {
  return new Date(day + "T00:00:00").toLocaleDateString(undefined, {
    ...(withWeekday ? { weekday: "short" as const } : {}),
    month: "short",
    day: "numeric",
  });
}
