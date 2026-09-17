"use client";

import { useEffect, useState } from "react";
import { fmtClock, fmtShort, todayISO } from "@/lib/dates";
import { useApp } from "../app-context";
import {
  CheckIcon,
  PauseIcon,
  PlayIcon,
  ResetIcon,
  TimerIcon,
} from "../icons";
import { Ring, SectionLabel } from "../ui";

const pad = (n: number) => String(n).padStart(2, "0");
const fmtSec = (s: number) =>
  `${pad(Math.floor(Math.max(0, s) / 60))}:${pad(Math.max(0, s) % 60)}`;

/** Marks the task matching the current session label as done. */
function MarkButton({
  label,
  onMark,
}: {
  label: string;
  onMark: (id: number) => Promise<void>;
}) {
  const { data } = useApp();
  const today = todayISO();
  const match = data.tasks.find(
    (t) => t.day === today && !t.done && !t.missed && t.title === label
  );
  return (
    <button
      type="button"
      disabled={!match}
      title={
        match
          ? `Mark "${label}" as done`
          : "Pick today's task as the session label to enable"
      }
      onClick={() => match && void onMark(match.id)}
      className="press flex h-12 items-center justify-center gap-1.5 rounded-xl border border-mint-500/30 bg-mint-500/10 text-[13px] font-extrabold text-mint-400 disabled:cursor-default disabled:opacity-35"
    >
      <CheckIcon width={14} height={14} strokeWidth={2.8} />
      Mark
    </button>
  );
}

export function FocusView() {
  const { data, addSession, toggleTask, focusPreset, consumeFocusPreset } =
    useApp();
  const today = todayISO();

  const [durationMin, setDurationMin] = useState(25);
  const [totalSec, setTotalSec] = useState(25 * 60);
  const [remaining, setRemaining] = useState(25 * 60);
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [label, setLabel] = useState("Deep work");
  const [adjustMode, setAdjustMode] = useState<"add" | "sub">("add");
  const [laps, setLaps] = useState<number[]>([]); // cumulative elapsed marks

  // Hand-off from the alarm overlay: load the task as the session label.
  useEffect(() => {
    if (focusPreset) {
      setLabel(focusPreset);
      consumeFocusPreset();
    }
  }, [focusPreset, consumeFocusPreset]);

  useEffect(() => {
    if (!running) return;
    const iv = setInterval(() => {
      setRemaining((r) => r - 1);
      setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(iv);
  }, [running]);

  useEffect(() => {
    if (!running || remaining > 0) return;
    setRunning(false);
    setRemaining(totalSec);
    setElapsed(0);
    setLaps([]);
    void addSession(label, Math.max(1, Math.round(elapsed / 60)));
  }, [remaining, running, totalSec, label, elapsed, addSession]);

  const progress =
    totalSec > 0 ? Math.min(1, Math.max(0, 1 - remaining / totalSec)) : 0;
  const mm = pad(Math.max(0, Math.floor(remaining / 60)));
  const ss = pad(Math.max(0, remaining % 60));

  const labelOptions = [
    "Deep work",
    ...data.tasks
      .filter((t) => t.day === today && !t.done)
      .map((t) => t.title),
  ];

  const todaySessions = data.sessions.filter(
    (s) => s.startedAt.slice(0, 10) === today
  );
  const todayMinutes = todaySessions.reduce((a, s) => a + s.durationMin, 0);

  function fmtDur(min: number) {
    if (min >= 60) return `${Math.floor(min / 60)}h ${pad(min % 60)}m`;
    return `${min}m`;
  }

  function pickPreset(m: number) {
    setDurationMin(m);
    setTotalSec(m * 60);
    setRemaining(m * 60);
    setElapsed(0);
    setLaps([]);
  }

  function adjust(m: number) {
    const delta = (adjustMode === "add" ? 1 : -1) * m * 60;
    const nr = Math.max(0, remaining + delta);
    setRemaining(nr);
    setTotalSec(Math.max(nr, totalSec + delta));
  }

  function reset() {
    setRunning(false);
    setTotalSec(durationMin * 60);
    setRemaining(durationMin * 60);
    setElapsed(0);
    setLaps([]);
  }

  return (
    <div className="animate-rise">
      <header className="flex items-center justify-between px-5 pt-6">
        <div>
          <h1 className="font-display text-[24px] font-bold text-bone-50">
            Focus
          </h1>
          <p className="mt-0.5 text-[11.5px] font-semibold text-fog-500">
            One timer. One thing.
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-[18px] font-bold text-bone-50">
            {fmtDur(todayMinutes)}
          </p>
          <p className="text-[10px] font-bold uppercase tracking-wider text-fog-500">
            today
          </p>
        </div>
      </header>

      <section className="mt-7 flex flex-col items-center px-5">
        <Ring value={progress} size={248} stroke={10}>
          <div className="text-center">
            <p
              className={`text-[10.5px] font-bold uppercase tracking-[0.24em] ${
                running ? "animate-breathe text-ember-400" : "text-fog-500"
              }`}
            >
              {running ? "In session" : remaining !== totalSec ? "Paused" : "Ready"}
            </p>
            <p className="mt-2 font-display text-[54px] font-bold leading-none tabular-nums text-bone-50">
              {mm}:{ss}
            </p>
            <p className="mx-auto mt-2.5 max-w-[160px] truncate text-[12px] font-semibold text-fog-400">
              {label}
            </p>
          </div>
        </Ring>

        {/* Duration presets */}
        <div className="mt-7 flex gap-2">
          {[15, 25, 45, 60].map((m) => (
            <button
              key={m}
              type="button"
              disabled={running}
              onClick={() => pickPreset(m)}
              className={`press rounded-full px-4 py-2 font-display text-[13px] font-bold transition-colors disabled:opacity-40 ${
                durationMin === m
                  ? "bg-bone-50 text-ink-950"
                  : "bg-ink-800 text-fog-400 border border-white/5"
              }`}
            >
              {m}m
            </button>
          ))}
        </div>

        {/* Fine adjustment — add or subtract time */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <div className="flex rounded-full border border-white/5 bg-ink-800 p-0.5">
            <button
              type="button"
              onClick={() => setAdjustMode("add")}
              className={`rounded-full px-3 py-1.5 font-display text-[12px] font-bold transition-colors ${
                adjustMode === "add" ? "bg-bone-50 text-ink-950" : "text-fog-500"
              }`}
            >
              + Add
            </button>
            <button
              type="button"
              onClick={() => setAdjustMode("sub")}
              className={`rounded-full px-3 py-1.5 font-display text-[12px] font-bold transition-colors ${
                adjustMode === "sub" ? "bg-bone-50 text-ink-950" : "text-fog-500"
              }`}
            >
              − Sub
            </button>
          </div>
          {[1, 2, 5, 10].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => adjust(m)}
              className="press rounded-full border border-white/8 bg-ink-800 px-3.5 py-1.5 font-display text-[12.5px] font-bold text-bone-300"
            >
              {adjustMode === "add" ? "+" : "−"}
              {m}m
            </button>
          ))}
        </div>

        {/* Session label — what this run counts toward */}
        <div className="mt-5 w-full">
          <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-[0.18em] text-fog-600">
            Session for
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {labelOptions.map((l, i) => (
              <button
                key={`${l}-${i}`}
                type="button"
                onClick={() => setLabel(l)}
                className={`press max-w-[220px] truncate rounded-full px-3.5 py-1.5 text-[11.5px] font-bold transition-colors ${
                  label === l
                    ? "border border-ember-500/30 bg-ember-500/15 text-ember-400"
                    : "border border-white/5 bg-ink-800 text-fog-400"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Controls — symmetric: primary on top, three equals below */}
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          className="press mt-6 flex h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-ember-500 text-[15px] font-extrabold text-ink-950 shadow-[0_10px_30px_-8px_rgba(255,106,43,0.5)]"
        >
          {running ? (
            <>
              <PauseIcon width={16} height={16} /> Pause
            </>
          ) : (
            <>
              <PlayIcon width={16} height={16} />{" "}
              {remaining !== totalSec ? "Resume" : "Start"}
            </>
          )}
        </button>
        <div className="mt-2.5 grid w-full grid-cols-3 gap-2">
          <button
            type="button"
            onClick={reset}
            className="press flex h-12 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-ink-800 text-[13px] font-bold text-fog-400"
          >
            <ResetIcon width={15} height={15} />
            Reset
          </button>
          <button
            type="button"
            disabled={!running}
            onClick={() => setLaps((l) => [...l, elapsed])}
            className="press flex h-12 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-ink-800 text-[13px] font-bold text-bone-300 disabled:cursor-default disabled:opacity-35"
          >
            <TimerIcon width={15} height={15} />
            Lap{laps.length > 0 ? ` · ${laps.length}` : ""}
          </button>
          <MarkButton label={label} onMark={toggleTask} />
        </div>

        {/* Laps */}
        {laps.length > 0 ? (
          <div className="mt-4 w-full rounded-2xl border border-white/5 bg-ink-800 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-fog-500">
              Laps
            </p>
            <div className="mt-2 space-y-1.5">
              {laps.map((mark, i) => {
                const split = mark - (laps[i - 1] ?? 0);
                return (
                  <div
                    key={i}
                    className="flex items-center justify-between text-[12px] font-semibold"
                  >
                    <span className="text-fog-500">#{i + 1}</span>
                    <span className="font-display text-bone-300">
                      +{fmtSec(split)}
                    </span>
                    <span className="font-display text-fog-400">
                      {fmtSec(mark)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      <section className="mt-9 px-5 pb-8">
        <SectionLabel
          right={
            <span className="text-[11px] font-bold text-fog-500">
              {todaySessions.length} session
              {todaySessions.length === 1 ? "" : "s"}
            </span>
          }
        >
          Session log
        </SectionLabel>
        {data.sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-ink-800/40 px-6 py-8 text-center">
            <TimerIcon width={22} height={22} className="mx-auto text-fog-600" />
            <p className="mt-2.5 font-display text-[15px] font-bold text-bone-300">
              No deep work yet
            </p>
            <p className="mt-1 text-[12px] font-medium text-fog-500">
              Run a session and it lands in the ledger.
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-ink-800">
            {data.sessions.slice(0, 6).map((s, i) => (
              <div
                key={s.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i > 0 ? "border-t border-white/5" : ""
                }`}
              >
                <span className="flex size-9 items-center justify-center rounded-xl bg-ember-500/10 text-ember-400">
                  <TimerIcon width={16} height={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-bone-100">
                    {s.label}
                  </p>
                  <p className="text-[11px] font-semibold text-fog-500">
                    {fmtShort(s.startedAt.slice(0, 10))} · {fmtClock(s.startedAt)}
                  </p>
                </div>
                <span className="font-display text-[13px] font-bold text-bone-300">
                  {s.durationMin}m
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
