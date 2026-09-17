/**
 * Kairos on-device database.
 *
 * Everything lives in localStorage so the app works fully offline — no server,
 * no network. This is the single source of truth on the device.
 */

import type {
  DayRecordDTO,
  HabitDTO,
  HabitLogDTO,
  IntentDTO,
  SessionDTO,
  StreakSettingsDTO,
  StreakStateDTO,
  TagDTO,
  TaskDTO,
} from "./types";
import {
  DEFAULT_STREAK_SETTINGS,
  DEFAULT_STREAK_STATE,
  TAG_PALETTE,
} from "./types";
import type { ScheduleConfig, TenureUnit } from "./ritual-meta";

export interface LocalRitualRow {
  id: number;
  name: string;
  icon: string;
  category: string;
}

export interface LocalCommitmentRow {
  id: number;
  ritualId: number;
  tenureValue: number;
  tenureUnit: TenureUnit;
  startDate: string;
  status: string; // ACTIVE | COMPLETE | EARLY_EXIT | ARCHIVED
  vacationBehavior: string; // pause | continue
  closeReason: string | null;
  closedAt: string | null; // ISO date
}

export interface LocalVersionRow {
  id: number;
  commitmentId: number;
  effectiveFrom: string;
  type: string; // ScheduleType
  config: ScheduleConfig;
  priority: number;
}

export interface LocalInstanceRow {
  id: number;
  commitmentId: number;
  versionId: number;
  dueDate: string;
  weekKey: string | null;
  status: string; // PENDING|DONE|MISSED|VACATION|NEUTRAL|CANCELLED
  prioritySnapshot: number;
  taskId: number | null;
}

export interface Profile {
  name: string;
  /** The first day the app was opened — the ledger tracks from here onward. */
  openedOn: string;
}

export interface LocalDB {
  seq: number;
  tasks: TaskDTO[];
  habits: HabitDTO[];
  logs: HabitLogDTO[];
  sessions: SessionDTO[];
  intents: IntentDTO[];
  streakState: StreakStateDTO;
  records: DayRecordDTO[];
  vacations: string[];
  settings: StreakSettingsDTO;
  tags: TagDTO[];
  rituals: LocalRitualRow[];
  commitments: LocalCommitmentRow[];
  versions: LocalVersionRow[];
  instances: LocalInstanceRow[];
  profile: Profile;
}

const DB_KEY = "kairos.db.v1";

/** Empty, honest defaults — no seeded tasks, rituals, or history. */
export function emptyDB(): LocalDB {
  return {
    seq: 1,
    tasks: [],
    habits: [],
    logs: [],
    sessions: [],
    intents: [],
    streakState: { ...DEFAULT_STREAK_STATE },
    records: [],
    vacations: [],
    settings: { ...DEFAULT_STREAK_SETTINGS },
    tags: [
      { name: "work", color: "work" },
      { name: "personal", color: "personal" },
      { name: "health", color: "health" },
      { name: "learning", color: "learning" },
      { name: "home", color: "home" },
    ],
    rituals: [],
    commitments: [],
    versions: [],
    instances: [],
    profile: { name: "", openedOn: "" },
  };
}

/** Stamp the first-open day once; used as the ledger's starting point. */
export function ensureOpenedOn(): string {
  const db = loadDB();
  if (!db.profile.openedOn) {
    // Late import avoided: localdb must stay dependency-light, so compute inline.
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    db.profile.openedOn = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    saveDB();
  }
  return db.profile.openedOn;
}

let cache: LocalDB | null = null;

export function loadDB(): LocalDB {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = emptyDB();
    return cache;
  }
  try {
    const raw = window.localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LocalDB>;
      cache = { ...emptyDB(), ...parsed };
      return cache;
    }
  } catch {
    /* corrupted storage — start clean */
  }
  cache = emptyDB();
  return cache;
}

export function saveDB(): void {
  if (!cache || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DB_KEY, JSON.stringify(cache));
  } catch {
    /* storage full / unavailable */
  }
}

export function nextId(db: LocalDB): number {
  db.seq += 1;
  return db.seq;
}

/** Reserve an id without incrementing twice — returns current then bumps. */
export function takeId(db: LocalDB): number {
  const id = db.seq;
  db.seq += 1;
  return id;
}

export function nextTagColor(db: LocalDB): string {
  return TAG_PALETTE[db.tags.length % TAG_PALETTE.length];
}

/* ── Profile helpers ── */
export function getProfile(): Profile {
  return loadDB().profile;
}

export function setProfileName(name: string): void {
  const db = loadDB();
  db.profile.name = name.trim();
  saveDB();
}

/** Wipe all user data (used when starting fresh). */
export function resetDB(): void {
  cache = emptyDB();
  saveDB();
}
