import { addDays, fromISO, toISO, todayISO } from "./dates";
import type { TaskDTO } from "./types";

export type DayStatus = "won" | "neutral" | "broken" | "pending";

/** Must + Should tasks count toward the day. Could tasks never do. */
export const isObligation = (t: TaskDTO) => t.priority === 1 || t.priority === 2;

/**
 * Status of a single day:
 * - won:     had Must/Should tasks, all completed
 * - broken:  at least one Must/Should task marked missed
 * - neutral: zero Must/Should tasks (or today still in play)
 * - pending: past day with unresolved incomplete obligations
 */
export function dayStatus(tasks: TaskDTO[], day: string): DayStatus {
  const oblig = tasks.filter((t) => t.day === day && isObligation(t));
  if (oblig.some((t) => t.missed)) return "broken";
  if (oblig.length === 0) return "neutral";
  if (oblig.every((t) => t.done)) return "won";
  return day < todayISO() ? "pending" : "neutral";
}

/**
 * Consecutive won days ending today (if today is already won) or yesterday.
 * Neutral days are skipped — they neither extend nor break the streak.
 * Broken or pending days stop the walk.
 */
export function computeStreak(tasks: TaskDTO[]): number {
  const today = todayISO();
  const obligations = tasks.filter(isObligation);
  if (obligations.length === 0) return 0;
  const minDay = obligations.reduce((a, t) => (a < t.day ? a : t.day), today);

  const start =
    dayStatus(tasks, today) === "won" ? today : addDays(today, -1);
  const d = fromISO(start);
  let n = 0;
  for (let i = 0; i < 4000; i++) {
    const iso = toISO(d);
    if (iso < minDay) break;
    const s = dayStatus(tasks, iso);
    if (s === "won") n += 1;
    else if (s !== "neutral") break;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/** Past Must/Should tasks left incomplete — candidates for carry or miss. */
export function pendingCarryTasks(tasks: TaskDTO[]): TaskDTO[] {
  const today = todayISO();
  return tasks.filter(
    (t) => !t.done && !t.missed && t.day < today && isObligation(t)
  );
}
