"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  addDays,
  dayNum,
  monthGrid,
  monthLabel,
  todayISO,
  weekdayLetter,
} from "@/lib/dates";
import type { StreakStatus } from "@/lib/streak-engine";
import {
  CARRY_LIMIT,
  PERFECT_RUN_TARGET,
  VACATION_LIMIT_PER_YEAR,
  type DayRecordDTO,
  type RecordStatus,
} from "@/lib/types";
import { useApp } from "./app-context";
import { FlameIcon, ShieldIcon } from "./icons";
import { Sheet } from "./ui";

const STATUS_META: Record<RecordStatus, { label: string; chip: string; cell: string }> = {
  PERFECT: { label: "Perfect", chip: "bg-mint-500/15 text-mint-400", cell: "bg-mint-500/80" },
  PROTECTED: { label: "Protected", chip: "bg-lilac-400/15 text-lilac-400", cell: "bg-lilac-400/70" },
  MISSED: { label: "Missed", chip: "bg-coral-400/15 text-coral-400", cell: "bg-coral-400/75" },
  NEUTRAL: { label: "Neutral", chip: "bg-white/8 text-fog-400", cell: "bg-fog-600/40" },
  INACTIVE: { label: "Inactive", chip: "bg-white/8 text-fog-400", cell: "bg-fog-600/40" },
  VACATION: { label: "Vacation", chip: "bg-sky-400/15 text-sky-400", cell: "bg-sky-400/60" },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h4 className="mb-2.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-fog-500">
        {title}
      </h4>
      {children}
    </section>
  );
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
        on ? "bg-ember-500" : "bg-ink-700"
      }`}
    >
      <span
        className={`block size-5 rounded-full bg-bone-50 transition-transform ${
          on ? "translate-x-5" : ""
        }`}
      />
    </button>
  );
}

function ToggleRow({
  label,
  desc,
  on,
  onChange,
}: {
  label: string;
  desc: string;
  on: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-white/5 py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="text-[13px] font-bold text-bone-100">{label}</p>
        <p className="text-[11px] font-medium text-fog-500">{desc}</p>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );
}

function fmtCountdown(min: number): string {
  if (min <= 0) return "now";
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

export function StreakSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return <StreakSheetInner onClose={onClose} />;
}

function StreakSheetInner({ onClose }: { onClose: () => void }) {
  const {
    streakState,
    records,
    vacationDays,
    streakSettings,
    status,
    setTab,
    openedOn,
    scheduleVacation,
    removeVacationDay,
    endOpenVacation,
    updateStreakSettings,
  } = useApp();
  const today = todayISO();
  const recordsMap = useMemo(
    () => Object.fromEntries(records.map((r) => [r.day, r])),
    [records]
  );

  const year = today.slice(0, 4);
  const usedThisYear = vacationDays.filter((d) => d.startsWith(year)).length;
  const futureVacation = vacationDays.filter((d) => d > today).sort();

  const [vacStart, setVacStart] = useState("");
  const [vacEnd, setVacEnd] = useState("");
  const [openEnded, setOpenEnded] = useState(false);
  const [vacErr, setVacErr] = useState("");

  const notable = useMemo(
    () =>
      [...records]
        .filter((r) => r.status !== "VACATION")
        .sort((a, b) => (a.day < b.day ? 1 : -1))
        .slice(0, 10),
    [records]
  );

  function goToStack() {
    onClose();
    setTimeout(
      () =>
        document
          .getElementById("today-stack")
          ?.scrollIntoView({ behavior: "smooth", block: "start" }),
      60
    );
  }

  async function submitVacation() {
    setVacErr("");
    const err = await scheduleVacation(vacStart, openEnded ? null : vacEnd, openEnded);
    if (err) {
      setVacErr(err);
      return;
    }
    setVacStart("");
    setVacEnd("");
    setOpenEnded(false);
  }

  const st = streakState;
  const runPct = Math.min(100, (st.perfectRun / PERFECT_RUN_TARGET) * 100);

  return (
    <Sheet open title="Your streak" onClose={onClose}>
      {/* Hero */}
      <div className="rounded-2xl border border-white/5 bg-ink-800 p-5">
        <div className="flex items-center gap-4">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-ember-500/12">
            <FlameIcon
              width={30}
              height={30}
              className={st.streak > 0 ? "text-ember-400" : "text-fog-500"}
            />
          </span>
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-[40px] font-bold leading-none text-bone-50">
                {st.streak}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-fog-500">
                day streak
              </span>
            </div>
            <p className="mt-1 text-[11.5px] font-semibold text-fog-500">
              Longest run: <span className="text-bone-300">{st.longest} days</span>
            </p>
          </div>
        </div>

        <StatusPanel status={status} cutoff={streakSettings.cutoffTime} />

        {(status.kind === "AT_RISK" ||
          status.kind === "FINAL_WARNING" ||
          status.kind === "INACTIVE_WARNING") && (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={goToStack}
              className="press h-10 flex-1 rounded-xl bg-ember-500 text-[12.5px] font-extrabold text-ink-950"
            >
              View remaining tasks
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                setTab("plan");
              }}
              className="press h-10 flex-1 rounded-xl border border-white/10 bg-ink-750 text-[12.5px] font-bold text-bone-300"
            >
              Open planner
            </button>
          </div>
        )}
      </div>

      {/* Protections */}
      <Section title="Protections">
        <div className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          <div className="flex items-center gap-3">
            {[0, 1].map((i) => (
              <span
                key={i}
                className={`flex size-10 items-center justify-center rounded-xl ${
                  i < st.protections
                    ? "bg-lilac-400/15 text-lilac-400"
                    : "bg-ink-750 text-fog-600"
                }`}
              >
                <ShieldIcon width={18} height={18} />
              </span>
            ))}
            <div className="flex-1">
              <p className="text-[13px] font-bold text-bone-100">
                {st.protections}/2 banked
              </p>
              <p className="text-[11px] font-medium text-fog-500">
                Used automatically when a day ends incomplete.
              </p>
            </div>
          </div>
          <div className="mt-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-fog-500">
                Perfect-run progress
              </p>
              <p className="font-display text-[12px] font-bold text-bone-300">
                {st.perfectRun}/{PERFECT_RUN_TARGET}
              </p>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-700">
              <div
                className="h-full rounded-full bg-gradient-to-r from-lilac-400 to-ember-400 transition-all duration-500"
                style={{ width: `${runPct}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] font-medium leading-relaxed text-fog-500">
              {PERFECT_RUN_TARGET} consecutive perfect days (every MUST + SHOULD
              done, no protection used, no inactive days) earns +1 protection.
              You started with 1 free.
            </p>
          </div>
        </div>
      </Section>

      {/* History */}
      <Section title={`History — ${monthLabel(today)}`}>
        <div className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          <div className="grid grid-cols-7 gap-1">
            {["M", "T", "W", "T", "F", "S", "S"].map((l, i) => (
              <span
                key={i}
                className="text-center text-[9px] font-bold uppercase text-fog-600"
              >
                {l}
              </span>
            ))}
            {monthGrid(today).flatMap((row, wi) =>
              row.map((d, di) =>
                d === null ? (
                  <div key={`${wi}-${di}`} />
                ) : (
                  <div
                    key={d}
                className={`flex h-9 items-center justify-center rounded-lg text-[11.5px] font-bold ${
                  recordsMap[d]
                    ? `${STATUS_META[recordsMap[d].status].cell} text-ink-950`
                    : d < openedOn || d > today
                      ? "text-fog-600/30"
                      : "bg-ink-750 text-fog-500"
                } ${d === today ? "ring-1 ring-ember-400/60" : ""}`}
                  >
                    {dayNum(d)}
                  </div>
                )
              )
            )}
          </div>
          <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
            {(Object.keys(STATUS_META) as RecordStatus[]).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={`size-2 rounded-full ${STATUS_META[k].cell}`} />
                <span className="text-[9.5px] font-bold uppercase tracking-wide text-fog-500">
                  {STATUS_META[k].label}
                </span>
              </span>
            ))}
          </div>
        </div>
      </Section>

      {/* Notable days */}
      <Section title="Day log">
        {notable.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-ink-800/40 px-4 py-5 text-center text-[12px] font-medium text-fog-500">
            No evaluated days yet — your first cutoff writes history.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-ink-800">
            {notable.map((r, i) => (
              <div
                key={r.day}
                className={`flex items-center gap-3 px-4 py-2.5 ${
                  i > 0 ? "border-t border-white/5" : ""
                }`}
              >
                <span className="w-14 shrink-0 font-display text-[12px] font-bold text-bone-300">
                  {r.day.slice(5)}
                </span>
                <span
                  className={`w-20 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[9px] font-bold uppercase tracking-wide ${STATUS_META[r.status].chip}`}
                >
                  {STATUS_META[r.status].label}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-fog-500">
                  {r.note}
                </span>
                <span className="shrink-0 text-[10.5px] font-bold text-fog-500">
                  🔥{r.streakAfter}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Vacation */}
      <Section title={`Vacation — ${Math.max(0, VACATION_LIMIT_PER_YEAR - usedThisYear)} of ${VACATION_LIMIT_PER_YEAR} days left in ${year}`}>
        <div className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          {st.vacationOpenStart ? (
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl bg-sky-400/10 px-3.5 py-3">
              <p className="text-[12px] font-bold text-sky-400">
                Open-ended vacation since {st.vacationOpenStart}
              </p>
              <button
                type="button"
                onClick={() => void endOpenVacation()}
                className="press shrink-0 rounded-full bg-sky-400 px-3 py-1.5 text-[11px] font-extrabold text-ink-950"
              >
                End now
              </button>
            </div>
          ) : null}

          <div className="flex gap-2">
            <div className="flex-1">
              <p className="mb-1 text-[9.5px] font-bold uppercase tracking-wider text-fog-600">
                From
              </p>
              <input
                type="date"
                value={vacStart}
                min={addDays(today, 1)}
                onChange={(e) => setVacStart(e.target.value)}
                className="w-full rounded-xl bg-ink-750 px-3 py-2.5 font-display text-[13px] font-semibold text-bone-100 outline-none"
              />
            </div>
            {!openEnded ? (
              <div className="flex-1">
                <p className="mb-1 text-[9.5px] font-bold uppercase tracking-wider text-fog-600">
                  To
                </p>
                <input
                  type="date"
                  value={vacEnd}
                  min={vacStart || addDays(today, 1)}
                  onChange={(e) => setVacEnd(e.target.value)}
                  className="w-full rounded-xl bg-ink-750 px-3 py-2.5 font-display text-[13px] font-semibold text-bone-100 outline-none"
                />
              </div>
            ) : null}
          </div>

          <label className="mt-3 flex items-center gap-2.5">
            <button
              type="button"
              role="switch"
              aria-checked={openEnded}
              onClick={() => setOpenEnded((o) => !o)}
              className={`h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors ${
                openEnded ? "bg-sky-400" : "bg-ink-700"
              }`}
            >
              <span
                className={`block size-5 rounded-full bg-bone-50 transition-transform ${
                  openEnded ? "translate-x-5" : ""
                }`}
              />
            </button>
            <span className="text-[12px] font-bold text-bone-300">
              Open-ended — until I end it
            </span>
          </label>

          {vacErr ? (
            <p className="mt-2 text-[11.5px] font-bold text-coral-400">{vacErr}</p>
          ) : null}

          <button
            type="button"
            onClick={() => void submitVacation()}
            className="press mt-3 h-11 w-full rounded-xl bg-sky-400 text-[13px] font-extrabold text-ink-950"
          >
            Schedule vacation
          </button>
          <p className="mt-2 text-[10.5px] font-medium leading-relaxed text-fog-600">
            Must start at least one day ahead — vacation can never rescue a
            failing day. Streak freezes: no gains, no losses, no inactive rule.
          </p>

          {futureVacation.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {futureVacation.map((d) => (
                <span
                  key={d}
                  className="flex items-center gap-1.5 rounded-full bg-sky-400/10 py-1 pl-2.5 pr-1.5 text-[10.5px] font-bold text-sky-400"
                >
                  {d.slice(5)}
                  <button
                    type="button"
                    onClick={() => void removeVacationDay(d)}
                    className="flex size-4 items-center justify-center rounded-full bg-sky-400/15 text-[9px]"
                    aria-label={`Remove ${d}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </Section>

      {/* Settings */}
      <Section title="Evaluation & notifications">
        <div className="rounded-2xl border border-white/5 bg-ink-800 px-4 py-1">
          <div className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="text-[13px] font-bold text-bone-100">Day cutoff</p>
              <p className="text-[11px] font-medium text-fog-500">
                Each day is evaluated at this time.
              </p>
            </div>
            <input
              type="time"
              value={streakSettings.cutoffTime}
              onChange={(e) =>
                void updateStreakSettings({ cutoffTime: e.target.value || "23:59" })
              }
              className="w-24 rounded-xl bg-ink-750 px-3 py-2 text-center font-display text-[13px] font-bold text-bone-100 outline-none"
            />
          </div>
          <ToggleRow
            label="Streak warnings"
            desc="Risk alerts for your streak"
            on={streakSettings.streakWarnings}
            onChange={() =>
              void updateStreakSettings({
                streakWarnings: !streakSettings.streakWarnings,
              })
            }
          />
          <ToggleRow
            label="Task reminders"
            desc="Pre-task reminders and alarms"
            on={streakSettings.taskReminders}
            onChange={() =>
              void updateStreakSettings({
                taskReminders: !streakSettings.taskReminders,
              })
            }
          />
          <ToggleRow
            label="Morning brief"
            desc="Daily overview of tasks and streak"
            on={streakSettings.morningBrief}
            onChange={() =>
              void updateStreakSettings({ morningBrief: !streakSettings.morningBrief })
            }
          />
          <ToggleRow
            label="Evening check-in"
            desc="3 hours before cutoff, if tasks remain"
            on={streakSettings.eveningCheckin}
            onChange={() =>
              void updateStreakSettings({
                eveningCheckin: !streakSettings.eveningCheckin,
              })
            }
          />
          <ToggleRow
            label="Final cutoff warning"
            desc="30 minutes before cutoff, if tasks remain"
            on={streakSettings.finalWarning}
            onChange={() =>
              void updateStreakSettings({ finalWarning: !streakSettings.finalWarning })
            }
          />
          <div className="flex items-center justify-between gap-3 border-t border-white/5 py-3">
            <div>
              <p className="text-[13px] font-bold text-bone-100">Quiet hours</p>
              <p className="text-[11px] font-medium text-fog-500">
                No streak notifications in this window.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="time"
                value={streakSettings.quietStart}
                onChange={(e) =>
                  void updateStreakSettings({ quietStart: e.target.value })
                }
                className="w-[86px] rounded-lg bg-ink-750 px-2 py-1.5 text-center font-display text-[12px] font-bold text-bone-100 outline-none"
              />
              <span className="text-[10px] font-bold text-fog-600">–</span>
              <input
                type="time"
                value={streakSettings.quietEnd}
                onChange={(e) =>
                  void updateStreakSettings({ quietEnd: e.target.value })
                }
                className="w-[86px] rounded-lg bg-ink-750 px-2 py-1.5 text-center font-display text-[12px] font-bold text-bone-100 outline-none"
              />
            </div>
          </div>
          <p className="border-t border-white/5 py-3 text-[10.5px] font-medium leading-relaxed text-fog-600">
            Turning notifications off never disables the streak itself —
            evaluation keeps running honestly.
          </p>
        </div>
      </Section>

      {/* How it works */}
      <Section title="How your streak works">
        <div className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          <ul className="space-y-2 text-[11.5px] font-medium leading-relaxed text-fog-400">
            <li>• A day is <span className="text-mint-400 font-bold">perfect</span> when every MUST and SHOULD task is done. COULD tasks never matter.</li>
            <li>• A day with no must/should tasks is neutral — one is allowed, two in a row reset the streak at the second cutoff.</li>
            <li>• An incomplete day asks: <span className="text-bone-300 font-bold">mark missed or carry forward</span>. Nothing is ever decided for you — except protections, which fire automatically.</li>
            <li>• Carry-forward is capped at {CARRY_LIMIT}×. A third attempt becomes an automatic miss.</li>
            <li>• Moving a task to a different day makes the original day neutral for that task; same-day time changes keep the obligation.</li>
            <li>• Vacation freezes everything — no gains, no losses — and is capped at {VACATION_LIMIT_PER_YEAR} days per year.</li>
          </ul>
        </div>
      </Section>
    </Sheet>
  );
}

function StatusPanel({
  status,
  cutoff,
}: {
  status: StreakStatus;
  cutoff: string;
}) {
  const tone =
    status.kind === "SAFE"
      ? "text-mint-400"
      : status.kind === "VACATION"
        ? "text-sky-400"
        : status.kind === "PROTECTED"
          ? "text-lilac-400"
          : status.kind === "FINAL_WARNING"
            ? "text-coral-400"
            : status.kind === "INACTIVE"
              ? "text-fog-400"
              : "text-ember-400";

  return (
    <div className="mt-4 rounded-xl bg-ink-750/70 px-4 py-3">
      <p className={`text-[12.5px] font-bold ${tone}`}>{status.headline}</p>
      <p className="mt-0.5 text-[11.5px] font-medium leading-relaxed text-fog-400">
        {status.detail}
      </p>
      {status.requiredTotal > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] font-bold text-fog-500">
          <span>
            Required:{" "}
            <span className="text-bone-300">
              {status.requiredDone}/{status.requiredTotal} done
            </span>
          </span>
          {status.remaining > 0 ? (
            <>
              <span>
                Time left:{" "}
                <span className="text-bone-300">
                  {fmtCountdown(status.minutesToCutoff)}
                </span>
              </span>
              <span>
                Cutoff: <span className="text-bone-300">{cutoff}</span>
              </span>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
