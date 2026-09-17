/**
 * Ritual system vocabulary — shared by server sync and client UI.
 * The one rule that matters: tenure is a DURATION; every date is derived.
 */

export type ScheduleType =
  | "daily"
  | "weekdays"
  | "days"
  | "every_n"
  | "monthly"
  | "flex_week";

export interface ScheduleConfig {
  /** 0=Mon … 6=Sun for "days" schedules. */
  days?: number[];
  /** Weekly target for flex_week. */
  n?: number;
  /** Interval for every_n. */
  every?: number;
  /** Day-of-month for monthly. */
  monthDay?: number;
  /** Optional time block "HH:mm". */
  time?: string | null;
}

export type TenureUnit = "DAY" | "WEEK" | "MONTH" | "YEAR";

export const TENURE_UNIT_DAYS: Record<TenureUnit, number> = {
  DAY: 1,
  WEEK: 7,
  MONTH: 30,
  YEAR: 365,
};

export type InstanceStatus =
  | "PENDING"
  | "DONE"
  | "MISSED"
  | "VACATION"
  | "NEUTRAL"
  | "CANCELLED";

export interface RitualCommitmentDTO {
  id: number;
  no: number;
  tenureValue: number;
  tenureUnit: TenureUnit;
  startDate: string;
  status: string; // ACTIVE | COMPLETE | EARLY_EXIT | ARCHIVED
  vacationBehavior: string; // pause | continue
  closeReason: string | null;
  closedAt: string | null;
  /* Derived tenure clock — never stored as authoritative dates. */
  requiredDays: number;
  activeDays: number;
  pausedDays: number;
  remainingDays: number;
  projectedCompletion: string | null;
  complete: boolean;
}

export interface RitualScheduleDTO {
  versionId: number;
  versionNo: number;
  effectiveFrom: string;
  type: ScheduleType;
  config: ScheduleConfig;
  priority: number;
}

export interface RitualWeekCell {
  day: string;
  /** done | missed | vacation | neutral | pending | today | upcoming | none */
  state: string;
}

export interface RitualDTO {
  id: number;
  name: string;
  icon: string;
  category: string;
  commitment: RitualCommitmentDTO;
  /** All commitment periods for this ritual, oldest first. */
  history: {
    id: number;
    no: number;
    tenureValue: number;
    tenureUnit: TenureUnit;
    status: string;
    startDate: string;
    closedAt: string | null;
  }[];
  schedule: RitualScheduleDTO;
  week: { days: RitualWeekCell[]; done: number; target: number };
}

export interface RitualCreateInput {
  name: string;
  icon: string;
  category: string;
  priority: number;
  scheduleType: ScheduleType;
  config: ScheduleConfig;
  tenureValue: number;
  tenureUnit: TenureUnit;
  vacationBehavior: "pause" | "continue";
}

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function scheduleLabel(type: ScheduleType, config: ScheduleConfig): string {
  switch (type) {
    case "daily":
      return "Every day";
    case "weekdays":
      return "Weekdays";
    case "days":
      return (config.days ?? [])
        .map((d) => WEEKDAY_SHORT[d] ?? "?")
        .join(" · ");
    case "every_n":
      return `Every ${config.every ?? 2} days`;
    case "monthly":
      return `Day ${config.monthDay ?? 1} each month`;
    case "flex_week":
      return `${config.n ?? 3}× within each week`;
    default:
      return "—";
  }
}

export function frequencyLabel(type: ScheduleType, config: ScheduleConfig): string {
  switch (type) {
    case "daily":
      return "daily";
    case "weekdays":
      return "5×/week";
    case "days":
      return `${(config.days ?? []).length}×/week`;
    case "every_n":
      return `every ${config.every ?? 2} days`;
    case "monthly":
      return "monthly";
    case "flex_week":
      return `${config.n ?? 3}×/week`;
    default:
      return "";
  }
}

export function tenureLabel(value: number, unit: TenureUnit): string {
  const u = unit.toLowerCase();
  return `${value} ${u}${value === 1 ? "" : "s"} tenure`;
}

/** "4 months 12 days" — 30-day months keep the arithmetic honest. */
export function spanLabel(days: number): string {
  const d = Math.max(0, Math.round(days));
  const months = Math.floor(d / 30);
  const rem = d % 30;
  if (months === 0) return `${rem} day${rem === 1 ? "" : "s"}`;
  if (rem === 0) return `${months} month${months === 1 ? "" : "s"}`;
  return `${months} month${months === 1 ? "" : "s"} ${rem} day${rem === 1 ? "" : "s"}`;
}

export function fmtShortISO(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
