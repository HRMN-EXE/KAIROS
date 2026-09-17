/**
 * Client-side ritual synchronization — the offline twin of the server sync.
 * Materializes commitment instances as task rows in the local DB and builds
 * the RitualDTO read-model. Tenure is a duration; dates are derived.
 */

import { addDays, fromISO, localDT, toISO, todayISO } from "./dates";
import {
  loadDB,
  nextId,
  saveDB,
  type LocalDB,
  type LocalInstanceRow,
  type LocalVersionRow,
} from "./localdb";
import { tenureClock } from "./tenure";
import type {
  RitualDTO,
  ScheduleConfig,
  ScheduleType,
  TenureUnit,
} from "./ritual-meta";
import type { TaskDTO } from "./types";

const FUTURE_WINDOW = 13;

function diffDays(a: string, b: string): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / 86400000);
}

function isoWeekKey(iso: string): string {
  const d = fromISO(iso);
  const t = new Date(d);
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const week1 = new Date(t.getFullYear(), 0, 4);
  const wn =
    1 +
    Math.round(
      ((t.getTime() - week1.getTime()) / 86400000 -
        3 +
        ((week1.getDay() + 6) % 7)) /
        7
    );
  return `${t.getFullYear()}-W${String(wn).padStart(2, "0")}`;
}

function scheduleMatches(
  type: ScheduleType,
  config: ScheduleConfig,
  day: string,
  startDate: string
): boolean {
  const d = fromISO(day);
  const dow = (d.getDay() + 6) % 7;
  switch (type) {
    case "daily":
      return true;
    case "weekdays":
      return dow < 5;
    case "days":
      return (config.days ?? []).includes(dow);
    case "every_n": {
      const every = Math.max(1, config.every ?? 2);
      return diffDays(startDate, day) % every === 0;
    }
    case "monthly":
      return d.getDate() === (config.monthDay ?? 1);
    case "flex_week":
      return true;
    default:
      return false;
  }
}

function isUnit(v: string | null | undefined): v is TenureUnit {
  return v === "DAY" || v === "WEEK" || v === "MONTH" || v === "YEAR";
}

function makeTask(db: LocalDB, t: Partial<TaskDTO> & { day: string; title: string }): TaskDTO {
  const task: TaskDTO = {
    id: nextId(db),
    title: t.title,
    notes: t.notes ?? "",
    day: t.day,
    time: t.time ?? null,
    priority: t.priority ?? 2,
    tag: t.tag ?? "personal",
    done: false,
    doneAt: null,
    carries: 0,
    missed: false,
    ritualInstanceId: t.ritualInstanceId ?? null,
    ritualId: t.ritualId ?? null,
    createdAt: localDT(new Date()),
  };
  db.tasks.push(task);
  return task;
}

/** Effective vacation set: saved days + elapsed days of an open-ended vacation. */
export function effectiveVacationSet(db: LocalDB, today: string): Set<string> {
  const set = new Set(db.vacations);
  const open = db.streakState.vacationOpenStart;
  if (open) {
    let d = open;
    let guard = 0;
    while (d <= today && guard < 400) {
      set.add(d);
      d = addDays(d, 1);
      guard++;
    }
  }
  return set;
}

/** Run the sync against the local DB, persist, and return the read-model. */
export function localRitualSync(): { rituals: RitualDTO[]; tasks: TaskDTO[] } {
  const db = loadDB();
  const today = todayISO();
  const vacSet = effectiveVacationSet(db, today);
  let mutated = false;

  for (const c of db.commitments) {
    if (c.status !== "ACTIVE") continue;
    const unit = isUnit(c.tenureUnit) ? c.tenureUnit : "MONTH";
    const clock = tenureClock({
      startDate: c.startDate,
      tenureValue: c.tenureValue,
      tenureUnit: unit,
      vacationBehavior: c.vacationBehavior,
      vacationSet: vacSet,
      today,
    });

    if (clock.complete) {
      c.status = "COMPLETE";
      c.closedAt = c.closedAt ?? today;
      mutated = true;
      continue;
    }

    const versions = db.versions
      .filter((v) => v.commitmentId === c.id)
      .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
    if (versions.length === 0) continue;
    const latest = versions[versions.length - 1];

    const dayMap = new Map<string, LocalInstanceRow>();
    for (const i of db.instances) {
      if (i.commitmentId === c.id) dayMap.set(i.dueDate, i);
    }

    const windowEnd = clock.projectedCompletion ?? addDays(today, FUTURE_WINDOW);

    /* ── rebind future un-finalized instances to the latest version ── */
    for (const inst of [...dayMap.values()]) {
      if (inst.status !== "PENDING" || inst.dueDate < today) continue;
      if (inst.dueDate < latest.effectiveFrom) continue;
      const stillScheduled = scheduleMatches(
        latest.type as ScheduleType,
        latest.config,
        inst.dueDate,
        c.startDate
      );
      if (!stillScheduled) {
        if (inst.taskId) {
          db.tasks = db.tasks.filter((t) => t.id !== inst.taskId);
        }
        inst.status = "NEUTRAL";
        inst.taskId = null;
        mutated = true;
        continue;
      }
      if (inst.versionId !== latest.id || inst.prioritySnapshot !== latest.priority) {
        inst.versionId = latest.id;
        inst.prioritySnapshot = latest.priority;
        if (inst.taskId) {
          const task = db.tasks.find((t) => t.id === inst.taskId);
          if (task) {
            task.priority = latest.priority;
            task.time = latest.config.time ?? null;
          }
        }
        mutated = true;
      }
    }

    /* ── generate instances across the full tenure ── */
    let cursor = c.startDate;
    let guard = 0;
    const maxSteps = Math.min(5000, Math.max(60, diffDays(c.startDate, windowEnd) + 3));
    while (cursor <= windowEnd && guard < maxSteps) {
      guard++;
      const day = cursor;
      cursor = addDays(cursor, 1);

      let version = versions[0];
      for (const v of versions) if (v.effectiveFrom <= day) version = v;
      if (version.effectiveFrom > day) continue;

      const existing = dayMap.get(day);
      const matches = scheduleMatches(
        version.type as ScheduleType,
        version.config,
        day,
        c.startDate
      );
      const onVacation = c.vacationBehavior === "pause" && vacSet.has(day);

      if (existing) {
        if (existing.dueDate > today) {
          if (existing.status === "PENDING" && onVacation && matches) {
            if (existing.taskId) {
              db.tasks = db.tasks.filter((t) => t.id !== existing.taskId);
            }
            existing.status = "VACATION";
            existing.taskId = null;
            mutated = true;
          } else if (existing.status === "VACATION" && !onVacation && matches) {
            const ritual = db.rituals.find((r) => r.id === c.ritualId);
            const task = makeTask(db, {
              title: ritual?.name ?? "Ritual",
              day,
              time: version.config.time ?? null,
              priority: version.priority,
              tag: ritual?.category ?? "personal",
              notes: "Ritual",
              ritualId: c.ritualId,
            });
            existing.status = "PENDING";
            existing.taskId = task.id;
            task.ritualInstanceId = existing.id;
            mutated = true;
          } else if (existing.status === "VACATION" && !matches) {
            existing.status = "NEUTRAL";
            mutated = true;
          }
        }
        continue;
      }

      if (!matches) continue;

      const inst: LocalInstanceRow = {
        id: nextId(db),
        commitmentId: c.id,
        versionId: version.id,
        dueDate: day,
        weekKey: isoWeekKey(day),
        status: onVacation ? "VACATION" : "PENDING",
        prioritySnapshot: version.priority,
        taskId: null,
      };
      db.instances.push(inst);
      dayMap.set(day, inst);
      mutated = true;

      if (!onVacation) {
        const ritual = db.rituals.find((r) => r.id === c.ritualId);
        const task = makeTask(db, {
          title: ritual?.name ?? "Ritual",
          day,
          time: version.config.time ?? null,
          priority: version.priority,
          tag: ritual?.category ?? "personal",
          notes: "Ritual",
          ritualId: c.ritualId,
        });
        inst.taskId = task.id;
        task.ritualInstanceId = inst.id;
      }
    }

    /* ── flexible weekly targets ── */
    if (latest.type === "flex_week") {
      const target = Math.max(1, latest.config.n ?? 3);
      const byWeek = new Map<string, LocalInstanceRow[]>();
      for (const inst of dayMap.values()) {
        if (!inst.weekKey) continue;
        const list = byWeek.get(inst.weekKey) ?? [];
        list.push(inst);
        byWeek.set(inst.weekKey, list);
      }
      for (const [, list] of byWeek) {
        const done = list.filter((i) => i.status === "DONE").length;
        const slots = target - done;
        if (slots <= 0) {
          for (const i of list.filter(
            (x) => x.status === "PENDING" && x.dueDate >= today
          )) {
            if (i.taskId) db.tasks = db.tasks.filter((t) => t.id !== i.taskId);
            i.status = "NEUTRAL";
            i.taskId = null;
            mutated = true;
          }
        } else {
          const futureOrToday = list.filter(
            (i) => i.status === "PENDING" && i.dueDate >= today
          );
          const optional = futureOrToday.length > slots;
          for (const i of futureOrToday) {
            if (!i.taskId) continue;
            const task = db.tasks.find((t) => t.id === i.taskId);
            if (task) task.priority = optional ? 3 : i.prioritySnapshot;
          }
          mutated = true;
        }
      }
    }
  }

  /* ── cancel futures for closed commitments ── */
  for (const c of db.commitments) {
    if (c.status === "ACTIVE") continue;
    for (const i of db.instances) {
      if (
        i.commitmentId === c.id &&
        i.dueDate > today &&
        i.status === "PENDING"
      ) {
        if (i.taskId) db.tasks = db.tasks.filter((t) => t.id !== i.taskId);
        i.status = "CANCELLED";
        i.taskId = null;
        mutated = true;
      }
    }
  }

  if (mutated) saveDB();
  return { rituals: buildDTOs(db, today, vacSet), tasks: db.tasks };
}

function buildDTOs(db: LocalDB, today: string, vacSet: Set<string>): RitualDTO[] {
  const dtos: RitualDTO[] = [];
  for (const r of db.rituals) {
    const commitments = db.commitments
      .filter((c) => c.ritualId === r.id)
      .sort((a, b) => a.id - b.id);
    if (commitments.length === 0) continue;
    const current = commitments[commitments.length - 1];
    const unit = isUnit(current.tenureUnit) ? current.tenureUnit : "MONTH";
    const clock = tenureClock({
      startDate: current.startDate,
      tenureValue: current.tenureValue,
      tenureUnit: unit,
      vacationBehavior: current.vacationBehavior,
      vacationSet: vacSet,
      today,
    });

    const versions = db.versions
      .filter((v) => v.commitmentId === current.id)
      .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? -1 : 1));
    const latest: LocalVersionRow | undefined = versions[versions.length - 1];
    const config = latest?.config ?? {};

    const instByDay = new Map(
      db.instances
        .filter((i) => i.commitmentId === current.id)
        .map((i) => [i.dueDate, i])
    );

    const sinceStart = diffDays(current.startDate, today);
    const windowStart =
      sinceStart >= 0
        ? addDays(current.startDate, Math.floor(sinceStart / 7) * 7)
        : current.startDate;
    const week = Array.from({ length: 7 }, (_, i) => addDays(windowStart, i));

    const cells = week.map((day) => {
      const inst = instByDay.get(day);
      let state = "none";
      if (inst) {
        if (inst.status === "DONE") state = "done";
        else if (inst.status === "MISSED") state = "missed";
        else if (inst.status === "VACATION") state = "vacation";
        else if (inst.status === "NEUTRAL" || inst.status === "CANCELLED")
          state = "neutral";
        else if (day === today) state = "today";
        else if (day < today) state = "missed";
        else state = "upcoming";
      }
      return { day, state };
    });
    const done = cells.filter((x) => x.state === "done").length;
    const target =
      latest?.type === "flex_week"
        ? Math.max(1, config.n ?? 3)
        : week.filter((day) =>
            latest
              ? scheduleMatches(
                  latest.type as ScheduleType,
                  config,
                  day,
                  current.startDate
                )
              : false
          ).length;

    dtos.push({
      id: r.id,
      name: r.name,
      icon: r.icon,
      category: r.category,
      commitment: {
        id: current.id,
        no: commitments.length,
        tenureValue: current.tenureValue,
        tenureUnit: unit,
        startDate: current.startDate,
        status: current.status,
        vacationBehavior: current.vacationBehavior,
        closeReason: current.closeReason,
        closedAt: current.closedAt,
        requiredDays: clock.requiredDays,
        activeDays: clock.activeDays,
        pausedDays: clock.pausedDays,
        remainingDays: clock.remainingDays,
        projectedCompletion:
          current.status === "ACTIVE" ? clock.projectedCompletion : null,
        complete: clock.complete || current.status === "COMPLETE",
      },
      history: commitments.map((c, i) => ({
        id: c.id,
        no: i + 1,
        tenureValue: c.tenureValue,
        tenureUnit: isUnit(c.tenureUnit) ? c.tenureUnit : "MONTH",
        status: c.status,
        startDate: c.startDate,
        closedAt: c.closedAt,
      })),
      schedule: {
        versionId: latest?.id ?? 0,
        versionNo: versions.length,
        effectiveFrom: latest?.effectiveFrom ?? today,
        type: (latest?.type ?? "daily") as ScheduleType,
        config,
        priority: latest?.priority ?? 2,
      },
      week: { days: cells, done, target },
    });
  }
  return dtos.sort((a, b) => {
    const aActive = a.commitment.status === "ACTIVE" ? 0 : 1;
    const bActive = b.commitment.status === "ACTIVE" ? 0 : 1;
    return aActive - bActive || a.name.localeCompare(b.name);
  });
}
