export interface TaskDTO {
  id: number;
  title: string;
  notes: string;
  day: string; // YYYY-MM-DD
  time: string | null; // HH:mm
  priority: number; // 1 must · 2 should · 3 could
  tag: string;
  done: boolean;
  doneAt: string | null; // local YYYY-MM-DDTHH:mm
  carries: number; // carry-forward counter, capped at 2
  missed: boolean; // explicitly missed — breaks the streak
  ritualInstanceId: number | null; // set when this task is a ritual instance
  ritualId: number | null;
  createdAt: string;
}

export interface TaskInput {
  title: string;
  day: string;
  time: string | null;
  priority: number;
  tag: string;
  notes: string;
}

export interface HabitDTO {
  id: number;
  name: string;
  icon: string;
  color: string;
  weekTarget: number;
}

export interface HabitInput {
  name: string;
  icon: string;
  color: string;
  weekTarget: number;
}

export interface HabitLogDTO {
  id: number;
  habitId: number;
  day: string;
}

export interface SessionDTO {
  id: number;
  label: string;
  durationMin: number;
  startedAt: string;
}

export interface IntentDTO {
  day: string;
  text: string;
}

export interface TagDTO {
  name: string;
  color: string;
}

/* ───────────────────────── streak system ───────────────────────── */

export type RecordStatus =
  | "PERFECT"
  | "MISSED"
  | "PROTECTED"
  | "NEUTRAL"
  | "INACTIVE"
  | "VACATION";

export interface StreakStateDTO {
  streak: number;
  longest: number;
  protections: number;
  perfectRun: number;
  giftClaimed: boolean;
  vacationOpenStart: string | null;
}

export interface DayRecordDTO {
  day: string;
  status: RecordStatus;
  streakAfter: number;
  note: string;
}

export interface StreakSettingsDTO {
  cutoffTime: string; // HH:mm — daily evaluation cutoff
  streakWarnings: boolean;
  taskReminders: boolean;
  morningBrief: boolean;
  eveningCheckin: boolean;
  finalWarning: boolean;
  quietStart: string; // HH:mm or "" = off
  quietEnd: string;
}

export const DEFAULT_STREAK_STATE: StreakStateDTO = {
  streak: 0,
  longest: 0,
  protections: 0,
  perfectRun: 0,
  giftClaimed: false,
  vacationOpenStart: null,
};

export const DEFAULT_STREAK_SETTINGS: StreakSettingsDTO = {
  cutoffTime: "23:59",
  streakWarnings: true,
  taskReminders: true,
  morningBrief: true,
  eveningCheckin: true,
  finalWarning: true,
  quietStart: "",
  quietEnd: "",
};

export const PROTECTION_MAX = 2;
export const PERFECT_RUN_TARGET = 15;
export const VACATION_LIMIT_PER_YEAR = 30;
export const CARRY_LIMIT = 2;

export interface StreakBundle {
  state: StreakStateDTO;
  records: DayRecordDTO[];
  vacationDays: string[];
  settings: StreakSettingsDTO;
}

export interface AppData {
  tasks: TaskDTO[];
  habits: HabitDTO[];
  logs: HabitLogDTO[];
  sessions: SessionDTO[];
  intent: IntentDTO | null;
  streak: StreakBundle;
  rituals: import("./ritual-meta").RitualDTO[];
  tags: TagDTO[];
}

export const TAGS = ["work", "personal", "health", "learning", "home"] as const;

/** Color name → chip classes (used by default and custom tags alike). */
export const TAG_COLOR_CLASSES: Record<string, string> = {
  work: "bg-sky-400/10 text-sky-400",
  personal: "bg-lilac-400/10 text-lilac-400",
  health: "bg-mint-400/10 text-mint-400",
  learning: "bg-gold-400/10 text-gold-400",
  home: "bg-coral-400/10 text-coral-400",
  ember: "bg-ember-500/10 text-ember-400",
  sky: "bg-sky-400/10 text-sky-400",
  lilac: "bg-lilac-400/10 text-lilac-400",
  mint: "bg-mint-400/10 text-mint-400",
  gold: "bg-gold-400/10 text-gold-400",
  coral: "bg-coral-400/10 text-coral-400",
};

/** Palette order for newly created custom tags. */
export const TAG_PALETTE = [
  "ember",
  "sky",
  "lilac",
  "mint",
  "gold",
  "coral",
];

/** Resolve chip classes for any tag name, custom or built-in. */
export function tagClasses(name: string, tags: TagDTO[] | undefined): string {
  const known = tags?.find((t) => t.name === name);
  if (known) return TAG_COLOR_CLASSES[known.color] ?? "bg-white/5 text-fog-400";
  return TAG_META[name] ?? "bg-white/5 text-fog-400";
}

export const PRIORITY_META: Record<
  number,
  { label: string; dot: string; text: string; border: string }
> = {
  1: {
    label: "Must",
    dot: "bg-ember-500",
    text: "text-ember-400",
    border: "border-ember-500/70",
  },
  2: {
    label: "Should",
    dot: "bg-gold-400",
    text: "text-gold-400",
    border: "border-gold-400/70",
  },
  3: {
    label: "Could",
    dot: "bg-fog-500",
    text: "text-fog-400",
    border: "border-fog-500/70",
  },
};

export const TAG_META: Record<string, string> = {
  work: "bg-sky-400/10 text-sky-400",
  personal: "bg-lilac-400/10 text-lilac-400",
  health: "bg-mint-400/10 text-mint-400",
  learning: "bg-gold-400/10 text-gold-400",
  home: "bg-coral-400/10 text-coral-400",
};

export const HABIT_COLORS: Record<
  string,
  { dot: string; soft: string; text: string }
> = {
  ember: { dot: "bg-ember-500", soft: "bg-ember-500/15", text: "text-ember-400" },
  mint: { dot: "bg-mint-500", soft: "bg-mint-500/15", text: "text-mint-400" },
  gold: { dot: "bg-gold-400", soft: "bg-gold-400/15", text: "text-gold-400" },
  lilac: { dot: "bg-lilac-400", soft: "bg-lilac-400/15", text: "text-lilac-400" },
  sky: { dot: "bg-sky-400", soft: "bg-sky-400/15", text: "text-sky-400" },
};

export const HABIT_ICONS = [
  "🏃",
  "📖",
  "🧘",
  "💧",
  "🌙",
  "✍️",
  "🎯",
  "🎨",
  "🥗",
  "☀️",
  "💪",
  "🧠",
];
