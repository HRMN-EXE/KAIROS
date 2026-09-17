/**
 * KAIROS streak engine — the single source of truth for streak evaluation.
 *
 * Principles:
 *  - Idempotent: a day is evaluated once, recorded immutably, never reprocessed.
 *  - Honest: the engine never completes, carries, or hides a task on its own.
 *  - Transparent: every outcome is written to day_records with a note.
 */

import { addDays, fromISO, toISO, todayISO } from "./dates";
import { isObligation, pendingCarryTasks } from "./streak";
import {
  PERFECT_RUN_TARGET,
  PROTECTION_MAX,
  VACATION_LIMIT_PER_YEAR,
  type DayRecordDTO,
  type RecordStatus,
  type StreakSettingsDTO,
  type StreakStateDTO,
  type TaskDTO,
} from "./types";

export interface StreakEvent {
  type:
    | "gift"
    | "protected"
    | "earned"
    | "broken"
    | "perfect"
    | "vacation-capped";
  message: string;
}

export interface EvalInput {
  now: Date;
  tasks: TaskDTO[];
  state: StreakStateDTO;
  records: Record<string, DayRecordDTO>;
  vacationDays: Set<string>;
  settings: StreakSettingsDTO;
}

export interface EvalResult {
  state: StreakStateDTO;
  newRecords: DayRecordDTO[];
  /** Vacation days materialized from an open-ended vacation. */
  vacationAdds: string[];
  events: StreakEvent[];
  changed: boolean;
}

/* ───────────────────────── primitives ───────────────────────── */

export function cutoffFor(day: string, settings: StreakSettingsDTO): Date {
  const [h, m] = (settings.cutoffTime || "23:59").split(":").map(Number);
  const d = fromISO(day);
  d.setHours(Number.isFinite(h) ? h : 23, Number.isFinite(m) ? m : 59, 0, 0);
  return d;
}

export function isVacationDay(
  day: string,
  vacationDays: Set<string>,
  openStart: string | null
): boolean {
  if (vacationDays.has(day)) return true;
  return openStart !== null && day >= openStart;
}

export function expandRange(start: string, end: string): string[] {
  const out: string[] = [];
  let d = fromISO(start);
  const stop = fromISO(end);
  let guard = 0;
  while (d <= stop && guard < 400) {
    out.push(toISO(d));
    d.setDate(d.getDate() + 1);
    guard++;
  }
  return out;
}

export function vacationUsageInYear(
  days: Iterable<string>,
  year: number
): number {
  const prefix = String(year);
  let n = 0;
  for (const d of days) if (d.startsWith(prefix)) n++;
  return n;
}

export function inQuietHours(now: Date, settings: StreakSettingsDTO): boolean {
  const { quietStart, quietEnd } = settings;
  if (!quietStart || !quietEnd) return false;
  const cur = `${String(now.getHours()).padStart(2, "0")}:${String(
    now.getMinutes()
  ).padStart(2, "0")}`;
  if (quietStart <= quietEnd) return cur >= quietStart && cur <= quietEnd;
  return cur >= quietStart || cur <= quietEnd; // wraps midnight
}

/* ───────────────────────── evaluation ───────────────────────── */

/**
 * Evaluate every day that is due but not yet recorded.
 * A day is due once its cutoff has passed. Pure with respect to input:
 * returns a new state + records to persist; never mutates history.
 */
export function evaluateDueDays(input: EvalInput): EvalResult {
  const st: StreakStateDTO = { ...input.state };
  const records = { ...input.records };
  const newRecords: DayRecordDTO[] = [];
  const vacationAdds: string[] = [];
  const events: StreakEvent[] = [];
  const today = todayISO();

  const addRecord = (
    day: string,
    status: RecordStatus,
    streakAfter: number,
    note: string
  ) => {
    const rec: DayRecordDTO = { day, status, streakAfter, note };
    records[day] = rec;
    newRecords.push(rec);
  };

  // Onboarding gift: exactly one free protection, granted once.
  if (!st.giftClaimed) {
    st.giftClaimed = true;
    st.protections = Math.min(PROTECTION_MAX, st.protections + 1);
    events.push({
      type: "gift",
      message: "Welcome gift — 1 streak protection 🛡",
    });
  }

  // Materialize elapsed days of an open-ended vacation (counted toward cap).
  if (st.vacationOpenStart) {
    const year = st.vacationOpenStart.slice(0, 4);
    let d = fromISO(st.vacationOpenStart);
    let guard = 0;
    while (toISO(d) <= today && guard < 400) {
      const iso = toISO(d);
      if (!input.vacationDays.has(iso)) {
        const used =
          vacationUsageInYear(input.vacationDays, Number(year)) +
          vacationUsageInYear(vacationAdds, Number(year));
        if (iso.startsWith(year) && used >= VACATION_LIMIT_PER_YEAR) {
          st.vacationOpenStart = null;
          events.push({
            type: "vacation-capped",
            message: `Vacation ended — ${VACATION_LIMIT_PER_YEAR}-day yearly limit reached`,
          });
          break;
        }
        vacationAdds.push(iso);
        input.vacationDays.add(iso);
      }
      d.setDate(d.getDate() + 1);
      guard++;
    }
  }

  const obligations = input.tasks.filter(isObligation);
  const giftChanged = input.state.giftClaimed !== st.giftClaimed;
  if (obligations.length === 0) {
    return {
      state: st,
      newRecords,
      vacationAdds,
      events,
      changed: giftChanged || vacationAdds.length > 0,
    };
  }

  const minDay = obligations.reduce(
    (a, t) => (a < t.day ? a : t.day),
    today
  );
  const todayEnded = input.now >= cutoffFor(today, input.settings);
  const endDay = todayEnded ? today : addDays(today, -1);

  let cursor = fromISO(minDay);
  let guard = 0;
  while (toISO(cursor) <= endDay && guard < 500) {
    guard++;
    const day = toISO(cursor);
    cursor.setDate(cursor.getDate() + 1);
    if (records[day]) continue; // already evaluated — no double increments

    if (isVacationDay(day, input.vacationDays, st.vacationOpenStart)) {
      addRecord(day, "VACATION", st.streak, "Vacation — streak frozen");
      continue;
    }

    const oblig = input.tasks.filter((t) => t.day === day && isObligation(t));

    if (oblig.length === 0) {
      const hadAnyTask = input.tasks.some((t) => t.day === day);
      const status: RecordStatus = hadAnyTask ? "NEUTRAL" : "INACTIVE";
      const yRec = records[addDays(day, -1)];
      const yesterdayInactive =
        yRec !== undefined &&
        (yRec.status === "INACTIVE" || yRec.status === "NEUTRAL");
      if (yesterdayInactive && st.streak > 0) {
        st.streak = 0;
        st.perfectRun = 0;
        addRecord(
          day,
          status,
          0,
          "Second consecutive inactive day — streak reset"
        );
        events.push({
          type: "broken",
          message: "Two inactive days in a row — streak reset",
        });
      } else {
        st.perfectRun = 0; // an inactive day is not a perfect day
        addRecord(
          day,
          status,
          st.streak,
          hadAnyTask
            ? "No must/should obligations — neutral"
            : "No tasks scheduled — neutral"
        );
      }
      continue;
    }

    const doneCount = oblig.filter((t) => t.done).length;
    const missedCount = oblig.filter((t) => t.missed && !t.done).length;
    const unresolved = oblig.filter((t) => !t.done && !t.missed);

    if (unresolved.length > 0) {
      if (st.protections > 0) {
        // Automatic protection: day ended with incomplete obligations.
        st.protections -= 1;
        st.perfectRun = 0;
        addRecord(
          day,
          "PROTECTED",
          st.streak,
          `${unresolved.length} incomplete — protection used`
        );
        events.push({
          type: "protected",
          message: "🛡 Protection used — streak preserved",
        });
      }
      // No protection: the day stays pending until the user decides
      // (carry forward or mark missed). Nothing is written, nothing is assumed.
      continue;
    }

    if (missedCount > 0) {
      if (st.protections > 0) {
        st.protections -= 1;
        st.perfectRun = 0;
        addRecord(
          day,
          "PROTECTED",
          st.streak,
          `${missedCount} missed — protection used`
        );
        events.push({
          type: "protected",
          message: "🛡 Protection used — streak preserved",
        });
      } else {
        st.streak = 0;
        st.perfectRun = 0;
        addRecord(day, "MISSED", 0, `${missedCount} task(s) missed`);
        events.push({
          type: "broken",
          message: "Streak broken — a required task was missed",
        });
      }
      continue;
    }

    // Every MUST + SHOULD completed → PERFECT.
    st.streak += 1;
    st.longest = Math.max(st.longest, st.streak);
    st.perfectRun += 1;
    let note = `All ${doneCount} must/should task(s) completed`;
    if (st.perfectRun >= PERFECT_RUN_TARGET) {
      if (st.protections < PROTECTION_MAX) {
        st.protections += 1;
        events.push({
          type: "earned",
          message: `${PERFECT_RUN_TARGET} perfect days — protection earned 🛡`,
        });
      }
      st.perfectRun = 0;
    }
    addRecord(day, "PERFECT", st.streak, note);
    events.push({ type: "perfect", message: "Perfect day — streak +1 🔥" });
  }

  const changed =
    giftChanged ||
    newRecords.length > 0 ||
    vacationAdds.length > 0 ||
    JSON.stringify(st) !== JSON.stringify(input.state);
  return { state: st, newRecords, vacationAdds, events, changed };
}

/* ───────────────────────── live status ───────────────────────── */

export type StreakStatusKind =
  | "SAFE"
  | "AT_RISK"
  | "FINAL_WARNING"
  | "VACATION"
  | "INACTIVE"
  | "INACTIVE_WARNING"
  | "PROTECTED";

export interface StreakStatus {
  kind: StreakStatusKind;
  requiredTotal: number;
  requiredDone: number;
  remaining: number;
  mustRemaining: number;
  shouldRemaining: number;
  minutesToCutoff: number;
  pendingDays: number;
  headline: string;
  detail: string;
}

/** Central risk assessment — every surface reads this, nothing recomputes it. */
export function getStreakStatus(input: EvalInput): StreakStatus {
  const today = todayISO();
  const base = {
    requiredTotal: 0,
    requiredDone: 0,
    remaining: 0,
    mustRemaining: 0,
    shouldRemaining: 0,
    pendingDays: pendingCarryTasks(input.tasks).length,
  };
  const minutesToCutoff = Math.max(
    0,
    Math.round((cutoffFor(today, input.settings).getTime() - input.now.getTime()) / 60000)
  );

  if (isVacationDay(today, input.vacationDays, input.state.vacationOpenStart)) {
    return {
      ...base,
      kind: "VACATION",
      minutesToCutoff,
      headline: "Vacation mode",
      detail: "Your streak is frozen. Rest easy — it resumes where it left off.",
    };
  }

  const rec = input.records[today];
  const oblig = input.tasks.filter((t) => t.day === today && isObligation(t));
  const done = oblig.filter((t) => t.done);
  const remainingTasks = oblig.filter((t) => !t.done);
  const mustRemaining = remainingTasks.filter((t) => t.priority === 1).length;
  const shouldRemaining = remainingTasks.filter((t) => t.priority === 2).length;
  const counts = {
    requiredTotal: oblig.length,
    requiredDone: done.length,
    remaining: remainingTasks.length,
    mustRemaining,
    shouldRemaining,
  };

  if (rec?.status === "PROTECTED") {
    return {
      ...base,
      ...counts,
      kind: "PROTECTED",
      minutesToCutoff,
      headline: "Protected 🛡",
      detail: "A protection kept your streak alive today.",
    };
  }

  if (rec?.status === "PERFECT" || (oblig.length > 0 && remainingTasks.length === 0)) {
    return {
      ...base,
      ...counts,
      kind: "SAFE",
      minutesToCutoff,
      headline: "Today's ritual complete ✓",
      detail: "Your streak is safe. See you tomorrow.",
    };
  }

  if (oblig.length === 0) {
    const yRec = input.records[addDays(today, -1)];
    const yesterdayInactive =
      yRec !== undefined &&
      (yRec.status === "INACTIVE" || yRec.status === "NEUTRAL");
    if (yesterdayInactive && input.state.streak > 0) {
      return {
        ...base,
        kind: "INACTIVE_WARNING",
        minutesToCutoff,
        headline: "Second consecutive inactive day",
        detail: `Schedule and complete a must/should task before the ${input.settings.cutoffTime} cutoff, or your streak resets.`,
      };
    }
    return {
      ...base,
      kind: "INACTIVE",
      minutesToCutoff,
      headline: "No obligations today",
      detail: "One inactive day is allowed — the day stays neutral.",
    };
  }

  if (minutesToCutoff <= 60) {
    return {
      ...base,
      ...counts,
      kind: "FINAL_WARNING",
      minutesToCutoff,
      headline: "Final warning",
      detail: `${remainingTasks.length} required ${
        remainingTasks.length === 1 ? "task" : "tasks"
      } left · ${
        minutesToCutoff > 0 ? `${minutesToCutoff} min` : "moments"
      } until the cutoff.`,
    };
  }

  return {
    ...base,
    ...counts,
    kind: "AT_RISK",
    minutesToCutoff,
    headline: "Your streak is at risk",
    detail:
      mustRemaining + shouldRemaining > 0
        ? `${mustRemaining > 0 ? `${mustRemaining} MUST` : ""}${
            mustRemaining > 0 && shouldRemaining > 0 ? " · " : ""
          }${shouldRemaining > 0 ? `${shouldRemaining} SHOULD` : ""} remaining — complete before ${input.settings.cutoffTime}.`
        : `${remainingTasks.length} required task(s) remaining.`,
  };
}
