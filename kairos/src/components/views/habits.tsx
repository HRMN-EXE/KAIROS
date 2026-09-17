"use client";

import { addDays, todayISO, weekdayLetter } from "@/lib/dates";
import {
  fmtShortISO,
  scheduleLabel,
  spanLabel,
  tenureLabel,
  type RitualDTO,
} from "@/lib/ritual-meta";
import { PRIORITY_META } from "@/lib/types";
import { useApp } from "../app-context";
import { CheckIcon, PlusIcon } from "../icons";
import { EmptyState } from "../ui";

/**
 * Commitments — rituals are time-bound commitments, not a habit tracker.
 * No individual streaks live here: weekly consistency only. The one true
 * streak belongs to the central engine, shown on the Today dashboard.
 */
export function HabitsView() {
  const { rituals, openRitualCreate } = useApp();
  const active = rituals.filter((r) => r.commitment.status === "ACTIVE");
  const past = rituals.filter((r) => r.commitment.status !== "ACTIVE");

  return (
    <div className="animate-rise">
      <header className="flex items-center justify-between px-5 pt-6">
        <div>
          <h1 className="font-display text-[24px] font-bold text-bone-50">
            Rituals
          </h1>
          <p className="mt-0.5 text-[11.5px] font-semibold text-fog-500">
            What you honor, for how long
          </p>
        </div>
        <button
          type="button"
          onClick={openRitualCreate}
          className="press flex h-9 items-center gap-1 rounded-full bg-ember-500 px-3.5 text-[12.5px] font-extrabold text-ink-950"
        >
          <PlusIcon width={14} height={14} strokeWidth={2.6} />
          New
        </button>
      </header>

      <section className="mt-6 space-y-3 px-5 pb-8">
        {rituals.length === 0 ? (
          <EmptyState
            title="No rituals yet"
            sub="Start a ritual once — KAIROS generates the daily obligations and feeds the streak engine."
          />
        ) : (
          <>
            {active.map((r) => (
              <RitualCard key={r.id} ritual={r} />
            ))}
            {past.length > 0 ? (
              <div className="pt-2">
                <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.18em] text-fog-600">
                  Past rituals
                </p>
                <div className="space-y-2">
                  {past.map((r) => (
                    <PastRitualRow key={r.id} ritual={r} />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function RitualCard({ ritual }: { ritual: RitualDTO }) {
  const { data, openRitualDetail, openRitualEdit, toggleTask, vacationDays, streakState } =
    useApp();
  const today = todayISO();
  const c = ritual.commitment;
  const p = PRIORITY_META[ritual.schedule.priority] ?? PRIORITY_META[2];

  const isVacToday =
    vacationDays.includes(today) ||
    (streakState.vacationOpenStart !== null &&
      today >= streakState.vacationOpenStart);
  const pausedNow =
    isVacToday && c.vacationBehavior === "pause" && c.status === "ACTIVE";

  const resumes = (() => {
    if (!pausedNow) return null;
    if (streakState.vacationOpenStart !== null) return null; // open-ended
    for (let i = 1; i <= 90; i++) {
      const d = addDays(today, i);
      if (!vacationDays.includes(d)) return d;
    }
    return null;
  })();

  const todayTask = data.tasks.find(
    (t) => t.ritualId === ritual.id && t.day === today && !t.missed
  );
  const pct = Math.min(100, (c.activeDays / Math.max(1, c.requiredDays)) * 100);

  return (
    <div className="rounded-2xl border border-white/5 bg-ink-800 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-ember-500/10 text-[20px]">
          {ritual.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold text-bone-50">
            {ritual.name}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-fog-500">
            {scheduleLabel(ritual.schedule.type, ritual.schedule.config)} ·{" "}
            <span className={p.text}>{p.label.toUpperCase()}</span> ·{" "}
            <span className="capitalize">{ritual.category}</span>
          </p>
        </div>
        <span
          className={`flex size-2.5 shrink-0 rounded-full ${
            pausedNow ? "bg-sky-400" : "bg-mint-500"
          }`}
        />
      </div>

      <p className="mt-3 text-[10.5px] font-bold uppercase tracking-[0.2em] text-ember-400">
        {tenureLabel(c.tenureValue, c.tenureUnit)}
      </p>

      {pausedNow ? (
        <div className="mt-2.5 rounded-xl bg-sky-400/10 px-3.5 py-3">
          <p className="text-[12px] font-extrabold text-sky-400">
            🌴 COMMITMENT PAUSED
          </p>
          <p className="mt-0.5 text-[11px] font-semibold text-fog-400">
            {streakState.vacationOpenStart !== null
              ? "Open-ended vacation — the clock resumes when you end it."
              : resumes
                ? `Resumes ${fmtShortISO(resumes)} · tenure clock paused, nothing lost.`
                : "Tenure clock paused — nothing lost."}
          </p>
        </div>
      ) : null}

      {/* Current 7-day cycle — consistency, not a streak */}
      <div className="mt-3">
        <div className="flex items-center justify-between">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-fog-600">
            This cycle
          </p>
          <p className="font-display text-[11.5px] font-bold text-bone-300">
            {ritual.week.done}/{ritual.week.target}
          </p>
        </div>
        <div className="mt-1.5 flex gap-1">
          {ritual.week.days.map((cell) => {
            const isToday = cell.day === today;
            const clickable = isToday && cell.state !== "done" && todayTask;
            return (
              <div key={cell.day} className="flex flex-1 flex-col items-center gap-1">
                <span
                  className={`text-[8px] font-bold uppercase ${
                    isToday ? "text-ember-400" : "text-fog-600"
                  }`}
                >
                  {weekdayLetter(cell.day)}
                </span>
                <button
                  type="button"
                  disabled={!clickable}
                  onClick={() => todayTask && void toggleTask(todayTask.id)}
                  aria-label={`${cell.day}: ${cell.state}`}
                  className={`flex size-8 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                    cell.state === "done"
                      ? "bg-mint-500 text-ink-950"
                      : cell.state === "missed"
                        ? "bg-coral-400/20 text-coral-400"
                        : cell.state === "vacation"
                          ? "bg-sky-400/15 text-sky-400"
                          : isToday
                            ? "press bg-ink-750 text-bone-100 ring-1 ring-ember-400/60"
                            : "bg-ink-750 text-fog-600"
                  } ${clickable ? "" : "cursor-default"}`}
                >
                  {cell.state === "done" ? (
                    <CheckIcon width={12} height={12} strokeWidth={3.2} />
                  ) : cell.state === "missed" ? (
                    "✕"
                  ) : cell.state === "vacation" ? (
                    "🌴"
                  ) : (
                    "○"
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tenure clock */}
      <div className="mt-3.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-ember-500 to-ember-300 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10.5px] font-semibold text-fog-500">
          <span>
            Active <span className="text-bone-300">{spanLabel(c.activeDays)}</span>
          </span>
          <span>
            Remaining{" "}
            <span className="text-bone-300">{spanLabel(c.remainingDays)}</span>
          </span>
          {c.pausedDays > 0 ? (
            <span className="text-sky-400">🌴 {c.pausedDays}d paused</span>
          ) : null}
          {c.projectedCompletion ? (
            <span className="ml-auto">
              ≈ {fmtShortISO(c.projectedCompletion)}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-3.5 flex gap-2">
        <button
          type="button"
          onClick={() => openRitualDetail(ritual)}
          className="press h-9 flex-1 rounded-lg bg-ink-750 text-[12px] font-bold text-bone-300"
        >
          View
        </button>
        <button
          type="button"
          onClick={() => openRitualEdit(ritual)}
          className="press h-9 flex-1 rounded-lg bg-ink-750 text-[12px] font-bold text-bone-300"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

function PastRitualRow({ ritual }: { ritual: RitualDTO }) {
  const { openRitualDetail } = useApp();
  const c = ritual.commitment;
  return (
    <button
      type="button"
      onClick={() => openRitualDetail(ritual)}
      className="press flex w-full items-center gap-3 rounded-xl border border-white/5 bg-ink-800/60 px-3.5 py-3 text-left"
    >
      <span className="text-[16px] opacity-70">{ritual.icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-fog-400">
          {ritual.name}
        </p>
        <p className="text-[10.5px] font-semibold text-fog-600">
          {tenureLabel(c.tenureValue, c.tenureUnit)} · started{" "}
          {fmtShortISO(c.startDate)}
        </p>
      </div>
      <span
        className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase ${
          c.status === "COMPLETE"
            ? "bg-sky-400/15 text-sky-400"
            : c.status === "EARLY_EXIT"
              ? "bg-coral-400/15 text-coral-400"
              : "bg-white/8 text-fog-500"
        }`}
      >
        {c.status === "EARLY_EXIT" ? "Early exit" : c.status.toLowerCase()}
      </span>
    </button>
  );
}
