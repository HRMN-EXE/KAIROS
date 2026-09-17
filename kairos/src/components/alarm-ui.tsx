"use client";

import { useState } from "react";
import { fmtTime } from "@/lib/dates";
import type { TaskDTO } from "@/lib/types";
import { BellIcon, CheckIcon, ClockIcon, TimerIcon, XIcon } from "./icons";

/** Silent reminder banner — T-5min heads-up or T-30min MUST lead. No sound. */
export function ReminderBanner({
  task,
  headline,
  onDone,
  onDismiss,
}: {
  task: TaskDTO;
  headline?: string;
  onDone: (id: number) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="pointer-events-auto flex animate-toast-in items-center gap-3 rounded-2xl border border-ember-500/25 bg-ink-750/95 px-4 py-3 shadow-2xl backdrop-blur">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-ember-500/15 text-ember-400">
        <ClockIcon width={16} height={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[9.5px] font-bold uppercase tracking-[0.18em] text-ember-400">
          {headline ?? `Up next · ${fmtTime(task.time)}`}
        </p>
        <p className="truncate text-[13px] font-bold text-bone-50">{task.title}</p>
      </div>
      <button
        type="button"
        onClick={() => onDone(task.id)}
        className="press flex h-8 items-center gap-1 rounded-full bg-mint-500 px-3 text-[11.5px] font-extrabold text-ink-950"
      >
        <CheckIcon width={12} height={12} strokeWidth={3} />
        Done
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss reminder"
        className="press flex size-8 items-center justify-center rounded-full bg-white/5 text-fog-400"
      >
        <XIcon width={13} height={13} />
      </button>
    </div>
  );
}

/** Full T-2min alarm — sound + vibration until resolved. Max 2 snoozes. */
export function AlarmOverlay({
  task,
  snoozeCount,
  onSnooze,
  onStop,
  onReschedule,
  onFocus,
}: {
  task: TaskDTO;
  snoozeCount: number;
  onSnooze: (minutes: number) => void;
  /** Stops the ringing without changing the task state. */
  onStop: () => void;
  onReschedule: () => void;
  onFocus: () => void;
}) {
  const [picking, setPicking] = useState(false);

  return (
    <div className="absolute inset-0 z-[60] flex animate-fade-in items-center justify-center bg-black/85 p-6">
      <div className="w-full rounded-3xl border border-ember-500/30 bg-ink-850 p-6 text-center shadow-[0_0_90px_rgba(255,106,43,0.28)]">
        <div className="mx-auto flex size-16 animate-breathe items-center justify-center rounded-full bg-ember-500/15 text-ember-400">
          <BellIcon width={28} height={28} />
        </div>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.26em] text-ember-400">
          Alarm · due {fmtTime(task.time)}
        </p>
        <h3 className="mt-2 font-display text-[21px] font-bold leading-snug text-bone-50">
          {task.title}
        </h3>
        <p className="mt-1.5 text-[11px] font-semibold text-fog-500">
          {snoozeCount}/2 snoozes used
        </p>

        {picking ? (
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-fog-500">
              Snooze for
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {[5, 10, 15, 20, 30, 45, 60].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => onSnooze(m)}
                  className="press rounded-full border border-white/8 bg-ink-750 px-3.5 py-1.5 font-display text-[12.5px] font-bold text-bone-300"
                >
                  {m}m
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 space-y-2">
          {snoozeCount === 0 ? (
            <button
              type="button"
              onClick={() => onSnooze(10)}
              className="press h-12 w-full rounded-xl border border-ember-500/30 bg-ember-500/10 text-[14px] font-extrabold text-ember-400"
            >
              Snooze · 10 min
            </button>
          ) : null}
          {snoozeCount === 1 ? (
            <button
              type="button"
              onClick={() => setPicking(true)}
              className="press h-12 w-full rounded-xl border border-ember-500/30 bg-ember-500/10 text-[14px] font-extrabold text-ember-400"
            >
              Snooze · pick duration…
            </button>
          ) : null}
          {snoozeCount >= 2 ? (
            <p className="rounded-xl bg-coral-400/10 px-3 py-2.5 text-[11.5px] font-bold text-coral-400">
              No snoozes left — wrap it up.
            </p>
          ) : null}

          <button
            type="button"
            onClick={onStop}
            className="press flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ember-500 text-[14px] font-extrabold text-ink-950"
          >
            <XIcon width={15} height={15} strokeWidth={2.8} />
            Stop
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onFocus}
              className="press flex h-12 items-center justify-center gap-2 rounded-xl bg-ember-500/15 text-[13px] font-extrabold text-ember-400 border border-ember-500/25"
            >
              <TimerIcon width={15} height={15} />
              Focus timer
            </button>
            <button
              type="button"
              onClick={onReschedule}
              className="press h-12 rounded-xl border border-white/10 bg-ink-800 text-[13px] font-bold text-bone-300"
            >
              Reschedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
