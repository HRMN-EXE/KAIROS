"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type SVGProps,
} from "react";
import {
  ALARM_LEAD_MS,
  MAX_SNOOZES,
  REMINDER_LEAD_MS,
  loadAlarmState,
  notifySystem,
  requestNotificationPermission,
  saveAlarmState,
  startAlarmSound,
  stopVibrate,
  vibrate,
} from "@/lib/alarm";
import { api } from "@/lib/api";
import { fmtTime, localDT, relativeDayLabel, todayISO } from "@/lib/dates";
import {
  evaluateDueDays,
  expandRange,
  getStreakStatus,
  inQuietHours,
  type EvalInput,
  type StreakEvent,
} from "@/lib/streak-engine";
import { pendingCarryTasks } from "@/lib/streak";
import {
  TAG_PALETTE,
  VACATION_LIMIT_PER_YEAR,
  type AppData,
  type DayRecordDTO,
  type HabitInput,
  type HabitLogDTO,
  type SessionDTO,
  type StreakSettingsDTO,
  type StreakStateDTO,
  type TaskDTO,
  type TaskInput,
} from "@/lib/types";
import type { RitualCreateInput, RitualDTO } from "@/lib/ritual-meta";
import { AlarmOverlay, ReminderBanner } from "./alarm-ui";
import { AppCtx, type TabId, type TaskSheetState } from "./app-context";
import { HabitSheet } from "./habit-sheet";
import { RitualDetailSheet } from "./ritual-detail";
import { RitualFormSheet, type RitualFormState } from "./ritual-form";
import {
  BarsIcon,
  CalendarIcon,
  LoopIcon,
  PlusIcon,
  SunIcon,
  TimerIcon,
} from "./icons";
import { ResolverSheet } from "./resolver-sheet";
import { StreakSheet } from "./streak-sheet";
import { TaskSheet } from "./task-sheet";
import { FocusView } from "./views/focus";
import { HabitsView } from "./views/habits";
import { PlanView } from "./views/plan";
import { StatsView } from "./views/stats";
import { TodayView } from "./views/today";

type IconComponent = (p: SVGProps<SVGSVGElement>) => ReactElement;

const TABS: { id: TabId; label: string; Icon: IconComponent }[] = [
  { id: "today", label: "Today", Icon: SunIcon },
  { id: "plan", label: "Plan", Icon: CalendarIcon },
  { id: "focus", label: "Focus", Icon: TimerIcon },
  { id: "habits", label: "Rituals", Icon: LoopIcon },
  { id: "stats", label: "Ledger", Icon: BarsIcon },
];

const MUST_LEAD_MS = 30 * 60_000;
const NOTIF_KEY = "kairos-notif-log-v1";

const EVENT_PRIORITY: Record<StreakEvent["type"], number> = {
  gift: 6,
  broken: 5,
  protected: 4,
  earned: 3,
  "vacation-capped": 2,
  perfect: 1,
};

interface ActiveAlarm {
  task: TaskDTO;
  snoozeCount: number;
}

interface ResolveState {
  items: TaskDTO[];
  missed: TaskDTO[];
}

interface ReminderItem {
  key: string;
  task: TaskDTO;
  headline?: string;
}

interface StreakNotice {
  id: number;
  title: string;
  body: string;
}

export default function PlannerApp({
  initial,
  name,
  openedOn,
}: {
  initial: AppData;
  name?: string;
  openedOn?: string;
}) {
  const [data, setData] = useState<AppData>(initial);
  const [tab, setTab] = useState<TabId>("today");
  const [taskSheet, setTaskSheet] = useState<TaskSheetState>(null);
  const [habitSheetOpen, setHabitSheetOpen] = useState(false);
  const [streakSheetOpen, setStreakSheetOpen] = useState(false);
  const [toastState, setToastState] = useState<{ id: number; text: string } | null>(
    null
  );
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [alarm, setAlarm] = useState<ActiveAlarm | null>(null);
  const [resolve, setResolve] = useState<ResolveState | null>(null);
  const [streakNotice, setStreakNotice] = useState<StreakNotice | null>(null);

  /* Streak system state */
  const [streakState, setStreakState] = useState<StreakStateDTO>(
    initial.streak.state
  );
  const [records, setRecords] = useState<DayRecordDTO[]>(initial.streak.records);
  const [vacationDays, setVacationDays] = useState<string[]>(
    initial.streak.vacationDays
  );
  const [streakSettings, setStreakSettings] = useState<StreakSettingsDTO>(
    initial.streak.settings
  );
  const [rituals, setRituals] = useState<RitualDTO[]>(initial.rituals);
  const [ritualForm, setRitualForm] = useState<RitualFormState>(null);
  const [ritualDetail, setRitualDetail] = useState<RitualDTO | null>(null);
  const [focusPreset, setFocusPreset] = useState<string | null>(null);
  const [clock, setClock] = useState(0);

  const consumeFocusPreset = useCallback(() => setFocusPreset(null), []);

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const alarmRef = useRef<ActiveAlarm | null>(null);
  alarmRef.current = alarm;
  const stopSoundRef = useRef<(() => void) | null>(null);
  const vibeIvRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resolveRanRef = useRef(false);
  const streakBusyRef = useRef(false);

  const streakStateRef = useRef(streakState);
  streakStateRef.current = streakState;
  const recordsRef = useRef(records);
  recordsRef.current = records;
  const vacationRef = useRef(vacationDays);
  vacationRef.current = vacationDays;
  const settingsRef = useRef(streakSettings);
  settingsRef.current = streakSettings;

  const toast = useCallback((text: string) => {
    const id = Date.now();
    setToastState({ id, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(
      () => setToastState((cur) => (cur?.id === id ? null : cur)),
      2600
    );
  }, []);

  /* ───────────────────── streak persistence ───────────────────── */

  const persistState = useCallback((s: StreakStateDTO) => {
    void api("/api/streak/state", {
      method: "POST",
      body: JSON.stringify(s),
    }).catch(() => {});
  }, []);

  /* ───────────────────── the streak engine loop ───────────────────── */

  const streakTick = useCallback(() => {
    if (streakBusyRef.current) return;
    streakBusyRef.current = true;
    try {
      const now = new Date();
      const settings = settingsRef.current;
      const input: EvalInput = {
        now,
        tasks: dataRef.current.tasks,
        state: streakStateRef.current,
        records: Object.fromEntries(recordsRef.current.map((r) => [r.day, r])),
        vacationDays: new Set(vacationRef.current),
        settings,
      };

      const result = evaluateDueDays(input);

      if (result.changed) {
        setStreakState(result.state);
        persistState(result.state);
        if (result.newRecords.length > 0) {
          const fresh = result.newRecords;
          setRecords((cur) => {
            const have = new Set(cur.map((r) => r.day));
            return [...cur, ...fresh.filter((r) => !have.has(r.day))];
          });
          let tz = "";
          try {
            tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
          } catch {
            /* ignore */
          }
          for (const r of fresh) {
            void api("/api/streak/day", {
              method: "POST",
              body: JSON.stringify({ ...r, tz }),
            }).catch(() => {});
          }
        }
        if (result.vacationAdds.length > 0) {
          const adds = result.vacationAdds;
          setVacationDays((cur) => [
            ...cur,
            ...adds.filter((d) => !cur.includes(d)),
          ]);
          void api("/api/streak/vacation", {
            method: "POST",
            body: JSON.stringify({ addDays: adds }),
          }).catch(() => {});
        }
        if (result.events.length > 0) {
          const top = [...result.events].sort(
            (a, b) => EVENT_PRIORITY[b.type] - EVENT_PRIORITY[a.type]
          )[0];
          toast(top.message);
        }
      }

      /* ── Intelligent notifications (deduped, quiet-hours aware) ── */
      const mergedInput: EvalInput = {
        ...input,
        state: result.state,
        records: Object.fromEntries([
          ...recordsRef.current,
          ...result.newRecords,
        ].map((r) => [r.day, r])),
      };
      const status = getStreakStatus(mergedInput);
      const quiet = inQuietHours(now, settings);
      const today = todayISO();

      const notifyOnce = (kind: string, title: string, body: string) => {
        const key = `${today}:${kind}`;
        try {
          const log = JSON.parse(
            window.localStorage.getItem(NOTIF_KEY) ?? "{}"
          ) as Record<string, boolean>;
          if (log[key]) return;
          log[key] = true;
          window.localStorage.setItem(NOTIF_KEY, JSON.stringify(log));
        } catch {
          /* ignore */
        }
        const id = Date.now();
        setStreakNotice({ id, title, body });
        notifySystem(title, body, `kairos-n-${key}`);
        window.setTimeout(
          () => setStreakNotice((cur) => (cur?.id === id ? null : cur)),
          10000
        );
      };

      // Morning brief — once per day, only when tasks exist.
      if (settings.morningBrief && !quiet && status.kind !== "VACATION") {
        const hour = now.getHours();
        const todays = dataRef.current.tasks.filter((t) => t.day === today);
        if (hour >= 6 && hour < 12 && todays.length > 0) {
          const must = todays.filter((t) => t.priority === 1).length;
          const should = todays.filter((t) => t.priority === 2).length;
          const could = todays.filter((t) => t.priority === 3).length;
          notifyOnce(
            "morning",
            "Good morning ☀",
            `${todays.length} tasks today (${must} must · ${should} should · ${could} could). Streak: ${result.state.streak} day${result.state.streak === 1 ? "" : "s"}.`
          );
        }
      }

      // Streak risk warnings.
      const canWarn =
        settings.streakWarnings && !quiet && status.kind !== "VACATION";
      if (canWarn && status.remaining > 0) {
        if (
          settings.eveningCheckin &&
          status.minutesToCutoff <= 180 &&
          status.minutesToCutoff > 30
        ) {
          notifyOnce(
            "evening",
            "Evening check-in",
            `${status.remaining} required task${status.remaining === 1 ? "" : "s"} remaining — your streak is at risk.`
          );
        }
        if (settings.finalWarning && status.minutesToCutoff <= 30) {
          notifyOnce(
            "final",
            "Final streak reminder",
            `Your ${result.state.streak}-day streak is at risk. ${status.remaining} required task${status.remaining === 1 ? "" : "s"} left · ${status.minutesToCutoff} min to the ${settings.cutoffTime} cutoff.`
          );
        }
      }
      if (canWarn && status.kind === "INACTIVE_WARNING") {
        notifyOnce(
          "inactive2",
          "Streak at risk",
          "Two consecutive inactive days — schedule and complete a must/should task today to keep your streak."
        );
      }
    } finally {
      streakBusyRef.current = false;
    }
  }, [persistState, toast]);

  /* ───────────────────── sheet openers ───────────────────── */

  const openTaskSheet = useCallback((day?: string) => {
    const d = day ?? todayISO();
    // New tasks can never be scheduled in the past.
    setTaskSheet({ mode: "create", day: d < todayISO() ? todayISO() : d });
  }, []);
  const editTaskSheet = useCallback(
    (task: TaskDTO) => setTaskSheet({ mode: "edit", task }),
    []
  );
  const openHabitSheet = useCallback(() => setHabitSheetOpen(true), []);
  const openStreakSheet = useCallback(() => setStreakSheetOpen(true), []);

  /* ───────────────────── ritual commitment system ───────────────────── */

  const applyBundle = useCallback((b: { rituals: RitualDTO[]; tasks: TaskDTO[] }) => {
    setRituals(b.rituals);
    setData((d) => ({ ...d, tasks: b.tasks }));
  }, []);

  const syncRituals = useCallback(async () => {
    try {
      const bundle = await api<{ rituals: RitualDTO[]; tasks: TaskDTO[] }>(
        "/api/rituals/sync",
        { method: "POST", body: "{}" }
      );
      applyBundle(bundle);
      window.setTimeout(() => streakTickRef.current?.(), 300);
    } catch {
      /* sync is best-effort */
    }
  }, [applyBundle]);

  const streakTickRef = useRef<(() => void) | null>(null);
  streakTickRef.current = streakTick;

  const createRitual = useCallback(
    async (input: RitualCreateInput, force = false) => {
      try {
        const res = await api<
          | { duplicate: { id: number; name: string } }
          | { ok: boolean; rituals: RitualDTO[]; tasks: TaskDTO[] }
        >("/api/rituals", {
          method: "POST",
          body: JSON.stringify({ ...input, force }),
        });
        if ("duplicate" in res) return { duplicate: res.duplicate };
        applyBundle(res);
        toast("Ritual started — instances will carry it 🔥");
        window.setTimeout(() => void syncRituals(), 1200);
        return null;
      } catch {
        toast("Couldn't create ritual");
        return null;
      }
    },
    [applyBundle, syncRituals, toast]
  );

  const ritualAction = useCallback(
    async (
      ritualId: number,
      action: "edit" | "end-early" | "archive" | "renew",
      payload: Record<string, unknown> = {}
    ) => {
      try {
        const res = await api<{ ok: boolean; rituals: RitualDTO[]; tasks: TaskDTO[] }>(
          `/api/rituals/${ritualId}`,
          { method: "POST", body: JSON.stringify({ action, ...payload }) }
        );
        applyBundle(res);
        window.setTimeout(() => void syncRituals(), 1200);
      } catch (err) {
        toast(err instanceof Error ? err.message : "Action failed");
      }
    },
    [applyBundle, syncRituals, toast]
  );

  const deleteRitual = useCallback(
    async (ritualId: number) => {
      try {
        const bundle = await api<{ rituals: RitualDTO[]; tasks: TaskDTO[] }>(
          `/api/rituals/${ritualId}`,
          { method: "DELETE" }
        );
        applyBundle(bundle);
        toast("Ritual deleted");
        window.setTimeout(() => streakTick(), 300);
      } catch (err) {
        toast(
          err instanceof Error && err.message
            ? err.message
            : "Couldn't delete ritual"
        );
      }
    },
    [applyBundle, streakTick, toast]
  );

  const openRitualCreate = useCallback(() => setRitualForm({ mode: "create" }), []);
  const openRitualEdit = useCallback(
    (r: RitualDTO) => {
      setRitualDetail(null);
      setRitualForm({ mode: "edit", ritualId: r.id });
    },
    []
  );
  const openRitualDetail = useCallback((r: RitualDTO) => setRitualDetail(r), []);

  /* ───────────────────── alarm side effects ───────────────────── */

  const stopAlarmFx = useCallback(() => {
    stopSoundRef.current?.();
    stopSoundRef.current = null;
    if (vibeIvRef.current) {
      clearInterval(vibeIvRef.current);
      vibeIvRef.current = null;
    }
    stopVibrate();
  }, []);

  const closeAlarm = useCallback(() => {
    stopAlarmFx();
    setAlarm(null);
  }, [stopAlarmFx]);

  useEffect(() => () => stopAlarmFx(), [stopAlarmFx]);

  const dismissReminder = useCallback((key: string) => {
    setReminders((cur) => cur.filter((r) => r.key !== key));
  }, []);

  const snoozeAlarm = useCallback(
    (minutes: number) => {
      const a = alarmRef.current;
      if (!a) return;
      const state = loadAlarmState();
      const e = state[String(a.task.id)];
      if (e) {
        e.snoozeCount = Math.min(MAX_SNOOZES, e.snoozeCount + 1);
        e.nextAlarmAt = Date.now() + minutes * 60_000;
        e.lastAlarmAt = null;
        saveAlarmState(state);
      }
      stopAlarmFx();
      setAlarm(null);
      toast(`Snoozed ${minutes} min`);
    },
    [stopAlarmFx, toast]
  );

  /* ───────────────────── the task alarm scheduler ───────────────────── */

  useEffect(() => {
    requestNotificationPermission();

    const tick = () => {
      const now = Date.now();
      const today = todayISO();
      const remindersEnabled = settingsRef.current.taskReminders;
      const state = loadAlarmState();
      let changed = false;
      const fired: ReminderItem[] = [];
      let firedAlarm: ActiveAlarm | null = null;

      for (const t of dataRef.current.tasks) {
        const key = String(t.id);
        const irrelevant =
          !t.time || t.done || t.missed || t.day < today || !remindersEnabled;
        if (irrelevant) {
          if (state[key]) {
            delete state[key];
            changed = true;
          }
          continue;
        }
        const target = new Date(`${t.day}T${t.time}:00`).getTime();
        if (Number.isNaN(target)) continue;
        const sig = `${t.day}T${t.time}`;
        let e = state[key];
        if (!e || e.sig !== sig) {
          e = {
            sig,
            reminderFired: false,
            mustLeadFired: false,
            lastAlarmAt: null,
            snoozeCount: 0,
            nextAlarmAt: null,
          };
          state[key] = e;
          changed = true;
        }

        // T-30min silent lead for MUST tasks.
        if (!e.mustLeadFired && t.priority === 1 && now >= target - MUST_LEAD_MS) {
          e.mustLeadFired = true;
          changed = true;
          fired.push({
            key: `must-${t.id}`,
            task: t,
            headline: `Upcoming MUST · ${fmtTime(t.time)}`,
          });
        }

        // T-5min silent reminder. Fires immediately if created inside the window.
        if (!e.reminderFired && now >= target - REMINDER_LEAD_MS) {
          e.reminderFired = true;
          changed = true;
          fired.push({ key: `rem-${t.id}`, task: t });
        }

        // T-2min alarm (or the snoozed time, if one is pending).
        const effective = e.nextAlarmAt ?? target - ALARM_LEAD_MS;
        if (now >= effective && e.lastAlarmAt !== effective) {
          e.lastAlarmAt = effective;
          changed = true;
          firedAlarm = { task: t, snoozeCount: e.snoozeCount };
        }
      }

      if (changed) saveAlarmState(state);

      for (const item of fired) {
        setReminders((cur) =>
          cur.some((r) => r.key === item.key) ? cur : [...cur, item]
        );
        notifySystem(
          "Kairos — up next",
          `${item.task.title} at ${item.task.time}`,
          `kairos-${item.key}`
        );
        window.setTimeout(() => dismissReminder(item.key), 9000);
      }

      if (firedAlarm && alarmRef.current?.task.id !== firedAlarm.task.id) {
        setAlarm(firedAlarm);
        stopSoundRef.current?.();
        stopSoundRef.current = startAlarmSound();
        vibrate([400, 180, 400, 180, 700]);
        if (vibeIvRef.current) clearInterval(vibeIvRef.current);
        vibeIvRef.current = setInterval(() => vibrate([400, 180, 400]), 1600);
      }
    };

    tick();
    const iv = setInterval(tick, 5000);
    return () => clearInterval(iv);
  }, [dismissReminder]);

  /* ───────────────────── streak clock: evaluate + re-render ───────────────────── */

  useEffect(() => {
    streakTick();
    const iv = setInterval(() => {
      setClock((c) => c + 1);
      streakTick();
    }, 15000);
    return () => clearInterval(iv);
  }, [streakTick]);

  // Server-stamped ritual sync shortly after load (tenure clocks, vacations,
  // auto-completion all reconcile on server time, not the device clock).
  const ritualSyncedRef = useRef(false);
  useEffect(() => {
    if (ritualSyncedRef.current) return;
    ritualSyncedRef.current = true;
    const t = setTimeout(() => void syncRituals(), 1000);
    return () => clearTimeout(t);
  }, [syncRituals]);

  const status = useMemo(
    () =>
      getStreakStatus({
        now: new Date(),
        tasks: data.tasks,
        state: streakState,
        records: Object.fromEntries(records.map((r) => [r.day, r])),
        vacationDays: new Set(vacationDays),
        settings: streakSettings,
      }),
    [data.tasks, streakState, records, vacationDays, streakSettings, clock]
  );

  /* ───────────────────── end-of-day resolver ───────────────────── */

  useEffect(() => {
    if (resolveRanRef.current) return;
    resolveRanRef.current = true;
    const pending = pendingCarryTasks(dataRef.current.tasks);
    if (pending.length === 0) return;
    const overCap = pending.filter((t) => t.carries >= 2);
    const askable = pending.filter((t) => t.carries < 2);
    // Carry limit exhausted → automatically missed, never silently carried.
    for (const t of overCap) void updateTaskInternal(t.id, { missed: true });
    setResolve({ items: askable, missed: overCap });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ───────────────────── task mutations ───────────────────── */

  const updateTask = useCallback(
    async (
      id: number,
      patch: Partial<TaskInput & { done: boolean; missed: boolean; carries: number }>
    ) => {
      const prev = dataRef.current.tasks.find((t) => t.id === id);
      setData((d) => ({
        ...d,
        tasks: d.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                ...patch,
                done: patch.done ?? t.done,
                doneAt:
                  patch.done === undefined
                    ? t.doneAt
                    : patch.done
                      ? localDT(new Date())
                      : null,
              }
            : t
        ),
      }));
      try {
        // Canonical server response replaces the optimistic copy so every
        // screen sees exactly what the database holds.
        const updated = await api<TaskDTO>(`/api/tasks/${id}`, {
          method: "PATCH",
          body: JSON.stringify(patch),
        });
        setData((d) => ({
          ...d,
          tasks: d.tasks.map((t) => (t.id === id ? updated : t)),
        }));
      } catch (err) {
        if (prev) {
          const restore = prev;
          setData((d) => ({
            ...d,
            tasks: d.tasks.map((t) => (t.id === id ? restore : t)),
          }));
        }
        toast(
          err instanceof Error && err.message
            ? err.message
            : "Couldn't update task"
        );
      }
      window.setTimeout(() => streakTick(), 400);
      if (prev?.ritualInstanceId) {
        window.setTimeout(() => void syncRituals(), 300);
      }
    },
    [streakTick, syncRituals, toast]
  );

  // Alias for use in effects defined before updateTask.
  function updateTaskInternal(
    id: number,
    patch: Partial<TaskInput & { done: boolean; missed: boolean; carries: number }>
  ) {
    void updateTask(id, patch);
  }

  const addTask = useCallback(
    async (input: TaskInput) => {
      try {
        const t = await api<TaskDTO>("/api/tasks", {
          method: "POST",
          body: JSON.stringify(input),
        });
        setData((d) => ({ ...d, tasks: [...d.tasks, t] }));
        toast(`Planned for ${relativeDayLabel(t.day)}`);
      } catch {
        toast("Couldn't save — try again");
      }
      window.setTimeout(() => streakTick(), 400);
    },
    [streakTick, toast]
  );

  const deleteTask = useCallback(
    async (id: number) => {
      const prev = dataRef.current.tasks.find((t) => t.id === id);
      setData((d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== id) }));
      try {
        await api(`/api/tasks/${id}`, { method: "DELETE" });
        toast("Task deleted");
        if (prev?.ritualInstanceId) {
          window.setTimeout(() => void syncRituals(), 300);
        }
        window.setTimeout(() => streakTick(), 300);
      } catch (err) {
        if (prev) {
          const restore = prev;
          setData((d) => ({ ...d, tasks: [...d.tasks, restore] }));
        }
        toast(
          err instanceof Error && err.message
            ? err.message
            : "Couldn't delete task"
        );
      }
    },
    [streakTick, syncRituals, toast]
  );

  const toggleTask = useCallback(
    async (id: number) => {
      const target = dataRef.current.tasks.find((t) => t.id === id);
      if (!target) return;
      const nextDone = !target.done;
      setData((d) => ({
        ...d,
        tasks: d.tasks.map((t) =>
          t.id === id
            ? {
                ...t,
                done: nextDone,
                doneAt: nextDone ? localDT(new Date()) : null,
                missed: nextDone ? false : t.missed,
              }
            : t
        ),
      }));
      if (nextDone) {
        const st = loadAlarmState();
        if (st[String(id)]) {
          delete st[String(id)];
          saveAlarmState(st);
        }
        setReminders((cur) => cur.filter((r) => r.task.id !== id));
        if (alarmRef.current?.task.id === id) {
          stopAlarmFx();
          setAlarm(null);
        }
        if (target.day === todayISO()) {
          const remainingOpen = dataRef.current.tasks.filter(
            (t) => t.day === todayISO() && !t.done && t.id !== id
          ).length;
          if (remainingOpen === 0) toast("Clean sheet — day cleared ✦");
        }
      }
      try {
        // Canonical server response keeps every screen in sync.
        const updated = await api<TaskDTO>(`/api/tasks/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ done: nextDone }),
        });
        setData((d) => ({
          ...d,
          tasks: d.tasks.map((t) => (t.id === id ? updated : t)),
        }));
      } catch (err) {
        setData((d) => ({
          ...d,
          tasks: d.tasks.map((t) =>
            t.id === id ? { ...t, done: target.done, doneAt: target.doneAt } : t
          ),
        }));
        toast(
          err instanceof Error && err.message
            ? err.message
            : "Couldn't update task"
        );
      }
      window.setTimeout(() => streakTick(), 400);
      // Ritual instance changed → refresh the cycle dots everywhere.
      if (target.ritualInstanceId) {
        window.setTimeout(() => void syncRituals(), 300);
      }
    },
    [stopAlarmFx, streakTick, syncRituals, toast]
  );

  /* ───────────────────── resolver actions ───────────────────── */

  const carryTask = useCallback(
    (t: TaskDTO) => {
      void updateTask(t.id, { day: todayISO(), carries: t.carries + 1 });
      setResolve((r) => {
        if (!r) return null;
        const items = r.items.filter((x) => x.id !== t.id);
        return items.length > 0 ? { ...r, items } : null;
      });
      toast("Carried to today");
    },
    [toast, updateTask]
  );

  const missTask = useCallback(
    (t: TaskDTO) => {
      void updateTask(t.id, { missed: true });
      setResolve((r) => {
        if (!r) return null;
        const items = r.items.filter((x) => x.id !== t.id);
        return items.length > 0 ? { ...r, items } : null;
      });
      toast("Marked missed");
    },
    [toast, updateTask]
  );

  /* ───────────────────── vacation & settings actions ───────────────────── */

  const scheduleVacation = useCallback(
    async (start: string, end: string | null, openEnded: boolean) => {
      const today = todayISO();
      if (!start) return "Pick a start date.";
      if (start <= today)
        return "Vacation must start at least one day in advance.";
      if (openEnded) {
        const next = { ...streakStateRef.current, vacationOpenStart: start };
        setStreakState(next);
        persistState(next);
        toast("Vacation mode scheduled 🏝");
        window.setTimeout(() => void syncRituals(), 800); // re-pause commitments
        return null;
      }
      if (!end || end < start) return "Pick an end date — or go open-ended.";
      const days = expandRange(start, end).filter((d) => d > today);
      if (days.length === 0) return "Pick at least one future day.";
      const counts = new Map<string, number>();
      for (const d of vacationRef.current) {
        const y = d.slice(0, 4);
        counts.set(y, (counts.get(y) ?? 0) + 1);
      }
      for (const d of days) {
        const y = d.slice(0, 4);
        counts.set(y, (counts.get(y) ?? 0) + 1);
      }
      for (const [y, n] of counts) {
        if (n > VACATION_LIMIT_PER_YEAR)
          return `Vacation limit reached — max ${VACATION_LIMIT_PER_YEAR} days in ${y}.`;
      }
      setVacationDays((cur) => [
        ...cur,
        ...days.filter((d) => !cur.includes(d)),
      ]);
      try {
        await api("/api/streak/vacation", {
          method: "POST",
          body: JSON.stringify({ addDays: days }),
        });
        toast(`Vacation scheduled — ${days.length} day${days.length === 1 ? "" : "s"} 🏝`);
        window.setTimeout(() => void syncRituals(), 800); // re-pause commitments
        return null;
      } catch (err) {
        setVacationDays(vacationRef.current);
        return err instanceof Error ? err.message : "Couldn't schedule vacation.";
      }
    },
    [persistState, toast]
  );

  const removeVacationDay = useCallback(
    async (day: string) => {
      const prev = vacationRef.current;
      setVacationDays((cur) => cur.filter((d) => d !== day));
      try {
        await api("/api/streak/vacation", {
          method: "POST",
          body: JSON.stringify({ removeDays: [day] }),
        });
        toast("Vacation day removed");
        window.setTimeout(() => void syncRituals(), 800);
      } catch {
        setVacationDays(prev);
        toast("Couldn't remove vacation day");
      }
    },
    [toast]
  );

  const endOpenVacation = useCallback(async () => {
    const next = { ...streakStateRef.current, vacationOpenStart: null };
    setStreakState(next);
    persistState(next);
    toast("Vacation ended — streak resumes where it left off");
    window.setTimeout(() => void syncRituals(), 800); // commitment clocks resume
  }, [persistState, syncRituals, toast]);

  const updateStreakSettings = useCallback(
    async (patch: Partial<StreakSettingsDTO>) => {
      const prev = settingsRef.current;
      const next = { ...prev, ...patch };
      setStreakSettings(next);
      try {
        await api("/api/streak/settings", {
          method: "POST",
          body: JSON.stringify(next),
        });
      } catch {
        setStreakSettings(prev);
        toast("Couldn't save settings");
      }
    },
    [toast]
  );

  /* ───────────────────── habits & misc mutations ───────────────────── */

  const addHabit = useCallback(
    async (input: HabitInput) => {
      try {
        const h = await api<AppData["habits"][number]>("/api/habits", {
          method: "POST",
          body: JSON.stringify(input),
        });
        setData((d) => ({ ...d, habits: [...d.habits, h] }));
        toast("Ritual started — day one");
      } catch {
        toast("Couldn't add ritual");
      }
    },
    [toast]
  );

  const deleteHabit = useCallback(
    async (id: number) => {
      const snapshot = dataRef.current;
      setData((d) => ({
        ...d,
        habits: d.habits.filter((h) => h.id !== id),
        logs: d.logs.filter((l) => l.habitId !== id),
      }));
      try {
        await api(`/api/habits/${id}`, { method: "DELETE" });
      } catch {
        setData(snapshot);
        toast("Couldn't delete ritual");
      }
    },
    [toast]
  );

  const toggleLog = useCallback(
    async (habitId: number, day: string) => {
      const existing = dataRef.current.logs.find(
        (l) => l.habitId === habitId && l.day === day
      );
      if (existing) {
        setData((d) => ({
          ...d,
          logs: d.logs.filter((l) => l.id !== existing.id),
        }));
        try {
          await api(`/api/habits/${habitId}/toggle`, {
            method: "POST",
            body: JSON.stringify({ day }),
          });
        } catch {
          setData((d) => ({ ...d, logs: [...d.logs, existing] }));
          toast("Couldn't update ritual");
        }
        return;
      }
      const tempId = -Date.now();
      setData((d) => ({
        ...d,
        logs: [...d.logs, { id: tempId, habitId, day }],
      }));
      try {
        const res = await api<{ on: boolean; log: HabitLogDTO | null }>(
          `/api/habits/${habitId}/toggle`,
          { method: "POST", body: JSON.stringify({ day }) }
        );
        if (res.log) {
          const saved = res.log;
          setData((d) => ({
            ...d,
            logs: d.logs.map((l) => (l.id === tempId ? saved : l)),
          }));
        }
      } catch {
        setData((d) => ({ ...d, logs: d.logs.filter((l) => l.id !== tempId) }));
        toast("Couldn't update ritual");
      }
    },
    [toast]
  );

  const addTag = useCallback(
    async (name: string) => {
      const clean = name.trim().toLowerCase().replace(/\s+/g, " ");
      if (!clean) return null;
      if (dataRef.current.tags.some((t) => t.name === clean)) return clean;
      const color =
        TAG_PALETTE[dataRef.current.tags.length % TAG_PALETTE.length];
      const tag = { name: clean, color };
      setData((d) => ({ ...d, tags: [...d.tags, tag] }));
      try {
        await api("/api/tags", {
          method: "POST",
          body: JSON.stringify({ name: clean, color }),
        });
        return clean;
      } catch {
        setData((d) => ({ ...d, tags: d.tags.filter((t) => t.name !== clean) }));
        toast("Couldn't create tag");
        return null;
      }
    },
    [toast]
  );

  const setIntent = useCallback(
    async (text: string) => {
      const day = todayISO();
      const prev = dataRef.current.intent;
      setData((d) => ({ ...d, intent: { day, text } }));
      try {
        await api("/api/intent", {
          method: "POST",
          body: JSON.stringify({ day, text }),
        });
      } catch {
        setData((d) => ({ ...d, intent: prev }));
        toast("Couldn't save intention");
      }
    },
    [toast]
  );

  const addSession = useCallback(
    async (label: string, durationMin: number) => {
      try {
        const s = await api<SessionDTO>("/api/focus", {
          method: "POST",
          body: JSON.stringify({ label, durationMin }),
        });
        setData((d) => ({ ...d, sessions: [s, ...d.sessions] }));
        toast(`Logged ${durationMin} min of focus ✦`);
      } catch {
        toast("Couldn't log session");
      }
    },
    [toast]
  );

  /* ───────────────────── render ───────────────────── */

  return (
    <AppCtx.Provider
      value={{
        data,
        profileName: name ?? "",
        openedOn: openedOn || todayISO(),
        tab,
        setTab,
        openTaskSheet,
        editTaskSheet,
        openHabitSheet,
        addTask,
        updateTask,
        deleteTask,
        toggleTask,
        addHabit,
        deleteHabit,
        toggleLog,
        setIntent,
        addSession,
        toast,
        addTag,
        streakState,
        records,
        vacationDays,
        streakSettings,
        status,
        openStreakSheet,
        scheduleVacation,
        removeVacationDay,
        endOpenVacation,
        updateStreakSettings,
        focusPreset,
        consumeFocusPreset,
        rituals,
        openRitualCreate,
        openRitualEdit,
        openRitualDetail,
        createRitual,
        ritualAction,
        deleteRitual,
        syncRituals,
      }}
    >
      <div className="relative flex h-full flex-col overflow-hidden">
        <div className="pointer-events-none absolute -top-28 left-1/2 z-0 h-56 w-[420px] -translate-x-1/2 rounded-full bg-ember-500/[0.07] blur-3xl" />

        <main className="no-scrollbar relative z-10 flex-1 overflow-y-auto">
          <div className={tab === "today" ? "" : "hidden"}>
            <TodayView />
          </div>
          <div className={tab === "plan" ? "" : "hidden"}>
            <PlanView />
          </div>
          <div className={tab === "focus" ? "" : "hidden"}>
            <FocusView />
          </div>
          <div className={tab === "habits" ? "" : "hidden"}>
            <HabitsView />
          </div>
          <div className={tab === "stats" ? "" : "hidden"}>
            <StatsView />
          </div>
        </main>

        <button
          type="button"
          onClick={() => openTaskSheet()}
          aria-label="Add task"
          className="press absolute bottom-[96px] right-5 z-20 flex size-14 items-center justify-center rounded-2xl bg-ember-500 text-ink-950 shadow-[0_14px_34px_-8px_rgba(255,106,43,0.55)]"
        >
          <PlusIcon width={22} height={22} strokeWidth={2.4} />
        </button>

        <nav
          className="relative z-20 border-t border-white/5 bg-ink-900/95 px-2 pt-2 backdrop-blur"
          style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
        >
          <div className="grid grid-cols-5">
            {TABS.map(({ id, label, Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  className="press flex flex-col items-center gap-1 py-1"
                >
                  <span
                    className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                      active
                        ? "bg-ember-500/12 text-ember-400"
                        : "text-fog-500"
                    }`}
                  >
                    <Icon width={20} height={20} />
                  </span>
                  <span
                    className={`text-[9.5px] font-bold tracking-wide ${
                      active ? "text-bone-100" : "text-fog-600"
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>

        {/* Streak warnings + task reminder banners */}
        {streakNotice || reminders.length > 0 ? (
          <div className="pointer-events-none absolute inset-x-3 top-3 z-[55] space-y-2">
            {streakNotice ? (
              <div className="pointer-events-auto flex animate-toast-in items-start gap-3 rounded-2xl border border-lilac-400/25 bg-ink-750/95 px-4 py-3 shadow-2xl backdrop-blur">
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-extrabold text-bone-50">
                    {streakNotice.title}
                  </p>
                  <p className="mt-0.5 text-[11.5px] font-medium leading-relaxed text-fog-400">
                    {streakNotice.body}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setStreakNotice(null)}
                  className="press flex size-7 shrink-0 items-center justify-center rounded-full bg-white/5 text-fog-400"
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            ) : null}
            {reminders.slice(0, 2).map((r) => (
              <ReminderBanner
                key={r.key}
                task={r.task}
                headline={r.headline}
                onDone={(id) => {
                  void toggleTask(id);
                  dismissReminder(r.key);
                }}
                onDismiss={() => dismissReminder(r.key)}
              />
            ))}
          </div>
        ) : null}

        <TaskSheet state={taskSheet} onClose={() => setTaskSheet(null)} />
        <HabitSheet
          open={habitSheetOpen}
          onClose={() => setHabitSheetOpen(false)}
        />
        <StreakSheet
          open={streakSheetOpen}
          onClose={() => setStreakSheetOpen(false)}
        />

        <RitualFormSheet
          state={ritualForm}
          ritual={
            ritualForm?.mode === "edit"
              ? rituals.find((r) => r.id === ritualForm.ritualId) ?? null
              : null
          }
          onClose={() => setRitualForm(null)}
        />
        <RitualDetailSheet
          ritual={
            ritualDetail
              ? rituals.find((r) => r.id === ritualDetail.id) ?? ritualDetail
              : null
          }
          onClose={() => setRitualDetail(null)}
        />

        {resolve ? (
          <ResolverSheet
            items={resolve.items}
            autoMissed={resolve.missed}
            onCarry={carryTask}
            onMiss={missTask}
            onClose={() => setResolve(null)}
          />
        ) : null}

        {alarm ? (
          <AlarmOverlay
            task={alarm.task}
            snoozeCount={alarm.snoozeCount}
            onSnooze={snoozeAlarm}
            onStop={() => closeAlarm()}
            onReschedule={() => {
              closeAlarm();
              editTaskSheet(alarm.task);
            }}
            onFocus={() => {
              setFocusPreset(alarm.task.title);
              closeAlarm();
              setTab("focus");
            }}
          />
        ) : null}

        {toastState ? (
          <div
            key={toastState.id}
            className="pointer-events-none absolute bottom-[104px] left-1/2 z-[70] -translate-x-1/2 animate-toast-in whitespace-nowrap rounded-full bg-bone-50 px-4 py-2 text-[12.5px] font-bold text-ink-950 shadow-xl"
          >
            {toastState.text}
          </div>
        ) : null}
      </div>
    </AppCtx.Provider>
  );
}
