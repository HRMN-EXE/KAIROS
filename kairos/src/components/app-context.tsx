"use client";

import { createContext, useContext } from "react";
import type { RitualCreateInput, RitualDTO } from "@/lib/ritual-meta";
import type { StreakStatus } from "@/lib/streak-engine";
import type {
  AppData,
  DayRecordDTO,
  HabitInput,
  StreakSettingsDTO,
  StreakStateDTO,
  TaskDTO,
  TaskInput,
} from "@/lib/types";

export type TabId = "today" | "plan" | "focus" | "habits" | "stats";

export type TaskSheetState =
  | { mode: "create"; day: string }
  | { mode: "edit"; task: TaskDTO }
  | null;

export interface AppApi {
  data: AppData;
  /** The user's name, entered at onboarding. */
  profileName: string;
  /** First day the app was opened — the ledger tracks from this day onward. */
  openedOn: string;
  tab: TabId;
  setTab: (t: TabId) => void;
  openTaskSheet: (day?: string) => void;
  editTaskSheet: (task: TaskDTO) => void;
  openHabitSheet: () => void;
  addTask: (input: TaskInput) => Promise<void>;
  updateTask: (
    id: number,
    patch: Partial<TaskInput & { done: boolean; missed: boolean; carries: number }>
  ) => Promise<void>;
  deleteTask: (id: number) => Promise<void>;
  toggleTask: (id: number) => Promise<void>;
  addHabit: (input: HabitInput) => Promise<void>;
  deleteHabit: (id: number) => Promise<void>;
  toggleLog: (habitId: number, day: string) => Promise<void>;
  setIntent: (text: string) => Promise<void>;
  addSession: (label: string, durationMin: number) => Promise<void>;
  toast: (text: string) => void;

  /** Create a custom tag. Returns the normalized name, or null on failure. */
  addTag: (name: string) => Promise<string | null>;

  /* Streak system */
  streakState: StreakStateDTO;
  records: DayRecordDTO[];
  vacationDays: string[];
  streakSettings: StreakSettingsDTO;
  /** Central risk assessment — never recompute this in components. */
  status: StreakStatus;
  openStreakSheet: () => void;
  /** Returns an error message, or null on success. */
  scheduleVacation: (
    start: string,
    end: string | null,
    openEnded: boolean
  ) => Promise<string | null>;
  removeVacationDay: (day: string) => Promise<void>;
  endOpenVacation: () => Promise<void>;
  updateStreakSettings: (patch: Partial<StreakSettingsDTO>) => Promise<void>;

  /* Focus hand-off from the alarm overlay */
  focusPreset: string | null;
  consumeFocusPreset: () => void;

  /* Ritual commitments — one obligation system, one streak */
  rituals: RitualDTO[];
  openRitualCreate: () => void;
  openRitualEdit: (r: RitualDTO) => void;
  openRitualDetail: (r: RitualDTO) => void;
  /** Returns { duplicate } when a same-name active commitment exists. */
  createRitual: (
    input: RitualCreateInput,
    force?: boolean
  ) => Promise<{ duplicate?: { id: number; name: string } } | null>;
  ritualAction: (
    ritualId: number,
    action: "edit" | "end-early" | "archive" | "renew",
    payload?: Record<string, unknown>
  ) => Promise<void>;
  /** Hard delete — only offered from the Rituals tab. */
  deleteRitual: (ritualId: number) => Promise<void>;
  syncRituals: () => Promise<void>;
}

export const AppCtx = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used inside PlannerApp");
  return ctx;
}
