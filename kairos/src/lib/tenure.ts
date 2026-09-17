/**
 * Pure tenure math — no database imports, safe for client and server.
 * Tenure is a DURATION; every date here is derived, never authoritative.
 */

import { addDays, fromISO, toISO } from "./dates";
import type { TenureUnit } from "./ritual-meta";

function diffDays(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
}

/** Calendar-aware tenure end for a pause-free commitment. */
export function addCalendarPeriod(
  start: string,
  unit: TenureUnit,
  value: number
): string {
  const d = fromISO(start);
  if (unit === "DAY") d.setDate(d.getDate() + Math.max(1, value) - 1);
  else if (unit === "WEEK") d.setDate(d.getDate() + Math.max(1, value) * 7 - 1);
  else if (unit === "MONTH") d.setMonth(d.getMonth() + Math.max(1, value));
  else d.setFullYear(d.getFullYear() + Math.max(1, value));
  return toISO(d);
}

/**
 * Tenure clock — calendar-based so a 6-month tenure started Sep 16 projects
 * to Mar 16, exactly as a person would count it. Pauses shift the projected
 * date day-for-day; the duration itself never changes.
 */
export function tenureClock(opts: {
  startDate: string;
  tenureValue: number;
  tenureUnit: TenureUnit;
  vacationBehavior: string;
  vacationSet: Set<string>;
  today: string;
}) {
  const baseEnd = addCalendarPeriod(
    opts.startDate,
    opts.tenureUnit,
    opts.tenureValue
  );
  const requiredDays = Math.max(1, diffDays(opts.startDate, baseEnd) + 1);
  let pausedDays = 0;
  let futurePauseDays = 0;
  if (opts.vacationBehavior === "pause") {
    for (const v of opts.vacationSet) {
      if (v >= opts.startDate && v <= opts.today) pausedDays++;
      else if (v > opts.today) futurePauseDays++;
    }
  }
  const elapsed =
    opts.startDate <= opts.today
      ? diffDays(opts.startDate, opts.today) + 1
      : 0;
  const activeDays = Math.max(0, elapsed - pausedDays);
  const remainingDays = Math.max(0, requiredDays - activeDays);
  const complete = activeDays >= requiredDays && elapsed > 0;
  const projectedCompletion = complete
    ? null
    : addDays(baseEnd, pausedDays + futurePauseDays);
  return {
    requiredDays,
    activeDays,
    pausedDays,
    remainingDays,
    complete,
    projectedCompletion,
  };
}
