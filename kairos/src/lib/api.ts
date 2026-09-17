/**
 * Kairos offline engine.
 *
 * This module keeps the exact same `api(path, init)` contract the app was
 * built on, but every "request" is served from the on-device localStorage
 * database — no network, no server. The app works perfectly offline.
 */

import { todayISO } from "./dates";
import {
  loadDB,
  nextId,
  nextTagColor,
  saveDB,
  type LocalDB,
  type LocalInstanceRow,
} from "./localdb";
import { localRitualSync } from "./local-rituals";
import type { ScheduleConfig, TenureUnit } from "./ritual-meta";
import type {
  DayRecordDTO,
  HabitDTO,
  HabitLogDTO,
  IntentDTO,
  SessionDTO,
  TaskDTO,
} from "./types";
import { VACATION_LIMIT_PER_YEAR } from "./types";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function parseBody(init?: RequestInit): Record<string, unknown> {
  if (!init?.body) return {};
  try {
    return JSON.parse(String(init.body)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const num = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v) : fallback;

/* ───────────────────────── task handlers ───────────────────────── */

function createTask(db: LocalDB, body: Record<string, unknown>): TaskDTO {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) throw new HttpError(400, "Title is required");
  const priority = num(body.priority, 2);
  const task: TaskDTO = {
    id: nextId(db),
    title,
    notes: typeof body.notes === "string" ? body.notes : "",
    day: typeof body.day === "string" && body.day ? body.day : todayISO(),
    time: typeof body.time === "string" && body.time ? body.time : null,
    priority: [1, 2, 3].includes(priority) ? priority : 2,
    tag: typeof body.tag === "string" && body.tag ? body.tag : "personal",
    done: false,
    doneAt: null,
    carries: 0,
    missed: false,
    ritualInstanceId: null,
    ritualId: null,
    createdAt: new Date().toISOString().slice(0, 16),
  };
  db.tasks.push(task);
  saveDB();
  return task;
}

function patchTask(db: LocalDB, id: number, body: Record<string, unknown>): TaskDTO {
  const row = db.tasks.find((t) => t.id === id);
  if (!row) throw new HttpError(404, "Task not found");
  const today = todayISO();

  // Universal lock: what's done is done.
  if (body.done === false && row.done) {
    throw new HttpError(403, "Completed tasks are final — they can't be unchecked.");
  }

  let inst: LocalInstanceRow | undefined;
  if (row.ritualInstanceId) {
    inst = db.instances.find((i) => i.id === row.ritualInstanceId);
    if (body.done === true && row.day !== today) {
      throw new HttpError(
        403,
        "Ritual instances are completed on their due date. Carry it forward or mark it missed instead."
      );
    }
    if (body.done === false && inst?.status === "DONE") {
      throw new HttpError(403, "Ticked rituals are final — they can't be unticked.");
    }
  }

  if (typeof body.title === "string" && body.title.trim()) row.title = body.title.trim();
  if (typeof body.day === "string") row.day = body.day;
  if (body.time === null || typeof body.time === "string") row.time = body.time || null;
  if (typeof body.priority === "number" && [1, 2, 3].includes(body.priority)) {
    row.priority = body.priority;
  }
  if (typeof body.tag === "string") row.tag = body.tag;
  if (typeof body.notes === "string") row.notes = body.notes;
  if (typeof body.done === "boolean") {
    row.done = body.done;
    row.doneAt = body.done ? new Date().toISOString().slice(0, 16) : null;
    if (body.done) row.missed = false;
  }
  if (typeof body.missed === "boolean") row.missed = body.missed;
  if (typeof body.carries === "number" && Number.isFinite(body.carries)) {
    row.carries = Math.min(2, Math.max(0, Math.round(body.carries)));
  }

  // Keep the linked ritual instance consistent — ONE completion record.
  if (row.ritualInstanceId && inst) {
    if (body.done === true) inst.status = "DONE";
    else if (body.done === false) inst.status = "PENDING";
    if (body.missed === true) inst.status = "MISSED";
    if (typeof body.day === "string" && body.day !== row.day) {
      // carry-forward moves the instance itself
    }
    if (typeof body.day === "string") inst.dueDate = body.day;
  }

  saveDB();
  return row;
}

function deleteTask(db: LocalDB, id: number): void {
  const row = db.tasks.find((t) => t.id === id);
  if (!row) return;
  if (row.ritualInstanceId) {
    throw new HttpError(
      403,
      "Ritual tasks can't be deleted here — manage the ritual in the Rituals tab."
    );
  }
  if (row.done) {
    throw new HttpError(403, "Completed tasks can't be deleted.");
  }
  db.tasks = db.tasks.filter((t) => t.id !== id);
  saveDB();
}

/* ───────────────────────── ritual handlers ───────────────────────── */

const TYPES = new Set(["daily", "weekdays", "days", "every_n", "monthly", "flex_week"]);
const UNITS = new Set(["DAY", "WEEK", "MONTH", "YEAR"]);

function createRitual(db: LocalDB, body: Record<string, unknown>) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) throw new HttpError(400, "Name is required");
  if (!body.scheduleType || !TYPES.has(String(body.scheduleType))) {
    throw new HttpError(400, "Invalid schedule type");
  }
  const unit = UNITS.has(String(body.tenureUnit ?? ""))
    ? (String(body.tenureUnit) as TenureUnit)
    : "MONTH";
  const tenureValue = Math.min(3650, Math.max(1, num(body.tenureValue, 6)));

  if (!body.force) {
    const dup = db.rituals.find(
      (r) =>
        r.name.trim().toLowerCase() === name.toLowerCase() &&
        db.commitments.some((c) => c.ritualId === r.id && c.status === "ACTIVE")
    );
    if (dup) return { duplicate: { id: dup.id, name: dup.name } };
  }

  const today = todayISO();
  const priority = num(body.priority, 2);
  const ritual = {
    id: nextId(db),
    name,
    icon: typeof body.icon === "string" && body.icon ? body.icon : "●",
    category: typeof body.category === "string" && body.category ? body.category : "personal",
  };
  db.rituals.push(ritual);
  const commitment = {
    id: nextId(db),
    ritualId: ritual.id,
    tenureValue,
    tenureUnit: unit,
    startDate: today,
    status: "ACTIVE",
    vacationBehavior: body.vacationBehavior === "continue" ? "continue" : "pause",
    closeReason: null,
    closedAt: null,
  };
  db.commitments.push(commitment);
  db.versions.push({
    id: nextId(db),
    commitmentId: commitment.id,
    effectiveFrom: today,
    type: String(body.scheduleType),
    config: { ...((body.config as ScheduleConfig | undefined) ?? {}) },
    priority: [1, 2, 3].includes(priority) ? priority : 2,
  });
  saveDB();
  const bundle = localRitualSync();
  return { ok: true, ...bundle };
}

function ritualAction(db: LocalDB, ritualId: number, body: Record<string, unknown>) {
  const action = String(body.action ?? "");
  const today = todayISO();
  const ritual = db.rituals.find((r) => r.id === ritualId);
  if (!ritual) throw new HttpError(404, "Ritual not found");
  const commitments = db.commitments
    .filter((c) => c.ritualId === ritualId)
    .sort((a, b) => a.id - b.id);
  const current = commitments[commitments.length - 1];
  if (!current) throw new HttpError(404, "No commitment found");

  if (action === "edit") {
    if (typeof body.name === "string" && body.name.trim()) ritual.name = body.name.trim();
    if (typeof body.icon === "string" && body.icon) ritual.icon = body.icon;
    if (typeof body.category === "string" && body.category) ritual.category = body.category;
    if (body.vacationBehavior === "pause" || body.vacationBehavior === "continue") {
      current.vacationBehavior = body.vacationBehavior;
    }
    const versions = db.versions
      .filter((v) => v.commitmentId === current.id)
      .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
    const latest = versions[versions.length - 1];
    const scheduleChanged =
      (typeof body.scheduleType === "string" && TYPES.has(body.scheduleType)) ||
      body.config !== undefined ||
      (typeof body.priority === "number" && [1, 2, 3].includes(body.priority));
    if (latest && scheduleChanged) {
      const nextConfig: ScheduleConfig = {
        ...latest.config,
        ...((body.config as ScheduleConfig | undefined) ?? {}),
      };
      db.versions.push({
        id: nextId(db),
        commitmentId: current.id,
        effectiveFrom: today,
        type:
          typeof body.scheduleType === "string" && TYPES.has(body.scheduleType)
            ? body.scheduleType
            : latest.type,
        config: nextConfig,
        priority:
          typeof body.priority === "number" && [1, 2, 3].includes(body.priority)
            ? body.priority
            : latest.priority,
      });
    }
  } else if (action === "end-early") {
    if (current.status !== "ACTIVE") {
      throw new HttpError(400, "Only active rituals can end early");
    }
    current.status = "EARLY_EXIT";
    current.closeReason =
      typeof body.reason === "string" ? body.reason.slice(0, 120) : "";
    current.closedAt = today;
  } else if (action === "archive") {
    if (current.status === "ACTIVE") {
      throw new HttpError(400, "End the ritual first — active rituals are never deleted");
    }
    current.status = "ARCHIVED";
    current.closedAt = current.closedAt ?? today;
  } else if (action === "renew") {
    if (current.status === "ACTIVE") {
      throw new HttpError(400, "Ritual is still active");
    }
    const unit = UNITS.has(String(body.tenureUnit ?? ""))
      ? (String(body.tenureUnit) as TenureUnit)
      : current.tenureUnit;
    const value = Math.min(3650, Math.max(1, num(body.tenureValue, current.tenureValue)));
    const nextCommitment = {
      id: nextId(db),
      ritualId,
      tenureValue: value,
      tenureUnit: unit,
      startDate: today,
      status: "ACTIVE",
      vacationBehavior: current.vacationBehavior,
      closeReason: null,
      closedAt: null,
    };
    db.commitments.push(nextCommitment);
    const versions = db.versions
      .filter((v) => v.commitmentId === current.id)
      .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
    const latest = versions[versions.length - 1];
    db.versions.push({
      id: nextId(db),
      commitmentId: nextCommitment.id,
      effectiveFrom: today,
      type: latest?.type ?? "daily",
      config: latest ? { ...latest.config } : {},
      priority: latest?.priority ?? 2,
    });
  } else {
    throw new HttpError(400, "Unknown action");
  }

  saveDB();
  const bundle = localRitualSync();
  return { ok: true, ...bundle };
}

function deleteRitual(db: LocalDB, ritualId: number) {
  const commitmentIds = db.commitments
    .filter((c) => c.ritualId === ritualId)
    .map((c) => c.id);
  db.tasks = db.tasks.filter((t) => t.ritualId !== ritualId);
  db.instances = db.instances.filter((i) => !commitmentIds.includes(i.commitmentId));
  db.versions = db.versions.filter((v) => !commitmentIds.includes(v.commitmentId));
  db.commitments = db.commitments.filter((c) => c.ritualId !== ritualId);
  db.rituals = db.rituals.filter((r) => r.id !== ritualId);
  saveDB();
  return localRitualSync();
}

/* ───────────────────────── the local router ───────────────────────── */

function dispatch(path: string, init?: RequestInit): unknown {
  const db = loadDB();
  const method = (init?.method ?? "GET").toUpperCase();
  const clean = path.split("?")[0];
  const parts = clean.split("/").filter(Boolean); // ["api", ...]
  const body = parseBody(init);
  const today = todayISO();

  /* tasks */
  if (parts[1] === "tasks") {
    if (parts.length === 2 && method === "POST") return createTask(db, body);
    const id = Number(parts[2]);
    if (method === "PATCH") return patchTask(db, id, body);
    if (method === "DELETE") return deleteTask(db, id);
  }

  /* habits */
  if (parts[1] === "habits") {
    if (parts.length === 2 && method === "POST") {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) throw new HttpError(400, "Name is required");
      const habit: HabitDTO = {
        id: nextId(db),
        name,
        icon: typeof body.icon === "string" && body.icon ? body.icon : "●",
        color: typeof body.color === "string" && body.color ? body.color : "ember",
        weekTarget: Math.min(7, Math.max(1, num(body.weekTarget, 5))),
      };
      db.habits.push(habit);
      saveDB();
      return habit;
    }
    const id = Number(parts[2]);
    if (parts.length === 3 && method === "DELETE") {
      db.habits = db.habits.filter((h) => h.id !== id);
      db.logs = db.logs.filter((l) => l.habitId !== id);
      saveDB();
      return undefined;
    }
    if (parts[3] === "toggle" && method === "POST") {
      const day = typeof body.day === "string" ? body.day : "";
      if (!day) throw new HttpError(400, "day is required");
      const existing = db.logs.find((l) => l.habitId === id && l.day === day);
      if (existing) {
        db.logs = db.logs.filter((l) => l.id !== existing.id);
        saveDB();
        return { on: false, log: null };
      }
      const log: HabitLogDTO = { id: nextId(db), habitId: id, day };
      db.logs.push(log);
      saveDB();
      return { on: true, log };
    }
  }

  /* focus sessions */
  if (parts[1] === "focus" && method === "POST") {
    const durationMin = num(body.durationMin, 0);
    if (durationMin <= 0) throw new HttpError(400, "durationMin must be positive");
    const s: SessionDTO = {
      id: nextId(db),
      label: typeof body.label === "string" && body.label.trim() ? body.label.trim() : "Deep work",
      durationMin,
      startedAt: new Date().toISOString().slice(0, 16),
    };
    db.sessions.unshift(s);
    db.sessions = db.sessions.slice(0, 200);
    saveDB();
    return s;
  }

  /* daily intent */
  if (parts[1] === "intent" && method === "POST") {
    const day = typeof body.day === "string" && body.day ? body.day : today;
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) throw new HttpError(400, "text is required");
    const existing = db.intents.find((i) => i.day === day);
    if (existing) existing.text = text;
    else db.intents.push({ day, text });
    saveDB();
    return { day, text } as IntentDTO;
  }

  /* tags */
  if (parts[1] === "tags" && method === "POST") {
    const name =
      typeof body.name === "string" ? body.name.trim().toLowerCase() : "";
    if (!name || name.length > 24) {
      throw new HttpError(400, "Tag name required (max 24 chars)");
    }
    if (!db.tags.some((t) => t.name === name)) {
      db.tags.push({
        name,
        color: typeof body.color === "string" && body.color ? body.color : nextTagColor(db),
      });
      saveDB();
    }
    return { ok: true };
  }

  /* streak */
  if (parts[1] === "streak") {
    if (parts[2] === "state" && method === "POST") {
      db.streakState = {
        streak: Math.max(0, num(body.streak, db.streakState.streak)),
        longest: Math.max(0, num(body.longest, db.streakState.longest)),
        protections: Math.min(
          2,
          Math.max(0, num(body.protections, db.streakState.protections))
        ),
        perfectRun: Math.min(
          15,
          Math.max(0, num(body.perfectRun, db.streakState.perfectRun))
        ),
        giftClaimed:
          typeof body.giftClaimed === "boolean"
            ? body.giftClaimed
            : db.streakState.giftClaimed,
        vacationOpenStart:
          typeof body.vacationOpenStart === "string" && body.vacationOpenStart
            ? body.vacationOpenStart
            : null,
      };
      saveDB();
      return { ok: true };
    }
    if (parts[2] === "day" && method === "POST") {
      const day = typeof body.day === "string" ? body.day : "";
      const status = String(body.status ?? "");
      const STATUSES = new Set([
        "PERFECT",
        "MISSED",
        "PROTECTED",
        "NEUTRAL",
        "INACTIVE",
        "VACATION",
      ]);
      if (!day || !STATUSES.has(status)) throw new HttpError(400, "Invalid day record");
      if (day > today) throw new HttpError(400, "Cannot finalize a future day");
      if (!db.records.some((r) => r.day === day)) {
        db.records.push({
          day,
          status: status as DayRecordDTO["status"],
          streakAfter: Math.max(0, num(body.streakAfter, 0)),
          note: typeof body.note === "string" ? body.note : "",
        });
        db.records.sort((a, b) => (a.day < b.day ? -1 : 1));
        saveDB();
      }
      return { ok: true };
    }
    if (parts[2] === "vacation" && method === "POST") {
      const addDaysList = (Array.isArray(body.addDays) ? body.addDays : []).filter(
        (d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)
      );
      const removeDaysList = (
        Array.isArray(body.removeDays) ? body.removeDays : []
      ).filter((d): d is string => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
      if (addDaysList.some((d) => d <= today)) {
        throw new HttpError(
          400,
          "Vacation must be scheduled in advance — past and current days are locked."
        );
      }
      if (addDaysList.length > 0) {
        const perYear = new Map<string, number>();
        for (const d of db.vacations) {
          const y = d.slice(0, 4);
          perYear.set(y, (perYear.get(y) ?? 0) + 1);
        }
        for (const d of addDaysList) {
          const y = d.slice(0, 4);
          perYear.set(y, (perYear.get(y) ?? 0) + 1);
        }
        for (const [year, count] of perYear) {
          if (count > VACATION_LIMIT_PER_YEAR) {
            throw new HttpError(
              400,
              `Vacation limit reached: max ${VACATION_LIMIT_PER_YEAR} days in ${year}.`
            );
          }
        }
        for (const d of new Set(addDaysList)) {
          if (!db.vacations.includes(d)) db.vacations.push(d);
        }
      }
      if (removeDaysList.length > 0) {
        db.vacations = db.vacations.filter(
          (d) => !(removeDaysList.includes(d) && d > today)
        );
      }
      saveDB();
      return { ok: true };
    }
    if (parts[2] === "settings" && method === "POST") {
      const time = (v: unknown, fallback: string) =>
        typeof v === "string" && (/^\d{2}:\d{2}$/.test(v) || v === "") ? v : fallback;
      const bool = (v: unknown, fallback: boolean) =>
        typeof v === "boolean" ? v : fallback;
      db.settings = {
        cutoffTime: time(body.cutoffTime, db.settings.cutoffTime),
        streakWarnings: bool(body.streakWarnings, db.settings.streakWarnings),
        taskReminders: bool(body.taskReminders, db.settings.taskReminders),
        morningBrief: bool(body.morningBrief, db.settings.morningBrief),
        eveningCheckin: bool(body.eveningCheckin, db.settings.eveningCheckin),
        finalWarning: bool(body.finalWarning, db.settings.finalWarning),
        quietStart: time(body.quietStart, db.settings.quietStart),
        quietEnd: time(body.quietEnd, db.settings.quietEnd),
      };
      saveDB();
      return { ok: true };
    }
  }

  /* rituals */
  if (parts[1] === "rituals") {
    if (parts.length === 2 && method === "POST") return createRitual(db, body);
    if (parts[2] === "sync" && method === "POST") return localRitualSync();
    const id = Number(parts[2]);
    if (method === "POST") return ritualAction(db, id, body);
    if (method === "DELETE") return deleteRitual(db, id);
  }

  throw new HttpError(404, "Not found");
}

/**
 * Drop-in replacement for the old network client — same signature, served
 * locally. Retry-on-hiccup kept for compatibility with callers.
 */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  // Yield a microtask so optimistic UI paints first, like a real request.
  await new Promise((r) => setTimeout(r, 40));
  try {
    return dispatch(path, init) as T;
  } catch (e) {
    if (e instanceof HttpError) throw new Error(e.message);
    throw new Error("Something went wrong — try again");
  }
}
