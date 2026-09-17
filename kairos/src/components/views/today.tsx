"use client";

import { useMemo, useState } from "react";
import {
  dayNum,
  fmtTime,
  greeting,
  monthShort,
  todayISO,
  weekdayShort,
  yearOf,
} from "@/lib/dates";
import { scheduleLabel } from "@/lib/ritual-meta";
import { PRIORITY_META, type TaskDTO } from "@/lib/types";
import { useApp } from "../app-context";
import { CheckIcon, LoopIcon, PencilIcon, SparkIcon } from "../icons";
import { StreakCard } from "../streak-card";
import { TaskRow } from "../task-row";
import { EmptyState, Ring, SectionLabel } from "../ui";

const byTime = (a: TaskDTO, b: TaskDTO) =>
  (a.time ?? "99:99").localeCompare(b.time ?? "99:99");

export function TodayView() {
  const {
    data,
    rituals,
    profileName,
    toggleTask,
    editTaskSheet,
    setTab,
    setIntent,
  } = useApp();
  const today = todayISO();

  const todays = useMemo(
    () => data.tasks.filter((t) => t.day === today),
    [data.tasks, today]
  );
  const open = todays.filter((t) => !t.done).sort(byTime);
  const doneItems = todays.filter((t) => t.done);
  const value = todays.length ? doneItems.length / todays.length : 0;

  const grouped = [1, 2, 3]
    .map((p) => ({ p, items: open.filter((t) => t.priority === p) }))
    .filter((g) => g.items.length > 0);

  const [editingIntent, setEditingIntent] = useState(false);
  const [intentText, setIntentText] = useState("");

  async function saveIntent() {
    setEditingIntent(false);
    if (!intentText.trim()) return;
    await setIntent(intentText.trim());
  }

  return (
    <div className="animate-rise">
      <header className="px-5 pt-6">
        <div className="flex items-center justify-between">
          <span className="font-display text-[12px] font-bold tracking-[0.32em] text-fog-500">
            KAIROS
          </span>
          <span className="truncate pl-3 text-[12px] font-semibold text-fog-500">
            {profileName ? `${greeting()}, ${profileName}` : greeting()}
          </span>
        </div>

        <div className="mt-6 flex items-end justify-between">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-[0.22em] text-ember-400">
              {weekdayShort(today)}
            </p>
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-[64px] font-bold leading-[0.95] text-bone-50">
                {dayNum(today)}
              </span>
              <span className="font-display text-[20px] font-medium text-fog-400">
                {monthShort(today)} {yearOf(today)}
              </span>
            </div>
          </div>
          <Ring value={value} size={78} stroke={6}>
            <div className="text-center">
              <p className="font-display text-[16px] font-bold leading-none text-bone-50">
                {Math.round(value * 100)}%
              </p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-wider text-fog-500">
                {doneItems.length}/{todays.length}
              </p>
            </div>
          </Ring>
        </div>
      </header>

      {/* The streak — primary feature, impossible to miss */}
      <section className="mt-6 px-5">
        <StreakCard />
      </section>

      {/* Rituals — honored commitments, front and center */}
      <section className="mt-4 px-5">
        {(() => {
          const ritualTasks = data.tasks.filter(
            (t) => t.ritualId !== null && t.day === today && !t.missed
          );
          const honored = ritualTasks.filter((t) => t.done).length;
          return (
            <div className="relative overflow-hidden rounded-3xl border border-ember-500/15 bg-ink-800">
              <div className="pointer-events-none absolute -right-12 -top-14 size-40 rounded-full bg-ember-500/[0.08] blur-2xl" />
              <div className="relative flex items-center justify-between px-4 pb-2.5 pt-4">
                <div className="flex items-center gap-2.5">
                  <span className="flex size-9 items-center justify-center rounded-xl bg-ember-500/12 text-ember-400">
                    <LoopIcon width={17} height={17} />
                  </span>
                  <div>
                    <p className="text-[13.5px] font-extrabold text-bone-50">
                      Rituals
                    </p>
                    <p className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-fog-500">
                      {ritualTasks.length === 0
                        ? "Rituals"
                        : `${honored}/${ritualTasks.length} honored today`}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTab("habits")}
                  className="press text-[11px] font-bold text-ember-400"
                >
                  Rituals →
                </button>
              </div>

              {ritualTasks.length === 0 ? (
                <div className="relative px-4 pb-4">
                  <div className="rounded-xl border border-dashed border-white/10 bg-ink-750/50 px-4 py-4 text-center">
                    <p className="text-[12.5px] font-bold text-bone-300">
                      No rituals due today
                    </p>
                    <p className="mt-0.5 text-[11px] font-medium text-fog-500">
                      Start a ritual — obligations generate themselves.
                    </p>
                    <button
                      type="button"
                      onClick={() => setTab("habits")}
                      className="press mt-2.5 h-9 rounded-full bg-ember-500 px-4 text-[11.5px] font-extrabold text-ink-950"
                    >
                      Start a ritual
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative border-t border-white/5">
                  {ritualTasks.map((t) => {
                    const r = rituals.find((x) => x.id === t.ritualId);
                    return (
                      <div
                        key={t.id}
                        className={`flex items-center gap-3 border-b border-white/5 px-4 py-3 last:border-b-0 ${
                          t.done ? "bg-mint-500/[0.04]" : ""
                        }`}
                      >
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-ink-750 text-[17px]">
                          {r?.icon ?? "●"}
                        </span>
                        <button
                          type="button"
                          onClick={() => editTaskSheet(t)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p
                            className={`truncate text-[14px] font-bold ${
                              t.done
                                ? "text-fog-500 line-through decoration-fog-600"
                                : "text-bone-100"
                            }`}
                          >
                            {t.title}
                          </p>
                          <p className="mt-0.5 flex items-center gap-2 text-[10.5px] font-semibold text-fog-500">
                            {t.time ? (
                              <span className="font-display text-[10.5px] font-bold text-ember-400/90">
                                {fmtTime(t.time)}
                              </span>
                            ) : null}
                            {r ? (
                              <span className="truncate">
                                {scheduleLabel(r.schedule.type, r.schedule.config)}
                              </span>
                            ) : null}
                          </p>
                        </button>
                        <button
                          type="button"
                          aria-label={t.done ? "Ticked — final" : "Mark done"}
                          title={t.done ? "Ticked rituals are final" : undefined}
                          onClick={() => {
                            if (!t.done) void toggleTask(t.id);
                          }}
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            t.done
                              ? "cursor-default border-mint-500 bg-mint-500 text-ink-950"
                              : "press border-fog-500/60 text-transparent"
                          }`}
                        >
                          {t.done ? (
                            <CheckIcon
                              width={14}
                              height={14}
                              strokeWidth={3.2}
                              className="animate-pop"
                            />
                          ) : null}
                        </button>
                      </div>
                    );
                  })}
                  {honored === ritualTasks.length ? (
                    <p className="bg-mint-500/5 px-4 py-2.5 text-center text-[11px] font-bold text-mint-400">
                      All rituals honored today ✓
                    </p>
                  ) : null}
                </div>
              )}
            </div>
          );
        })()}
      </section>

      {/* One thing */}
      <section className="mt-4 px-5">
        {editingIntent ? (
          <div className="rounded-2xl border border-ember-500/40 bg-ink-800 p-4">
            <input
              autoFocus
              value={intentText}
              onChange={(e) => setIntentText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void saveIntent();
                if (e.key === "Escape") setEditingIntent(false);
              }}
              onBlur={() => void saveIntent()}
              placeholder="What would make today a win?"
              className="w-full bg-transparent font-display text-[16px] font-semibold text-bone-50 outline-none placeholder:text-fog-600"
            />
            <p className="mt-2 pl-0.5 text-[10.5px] font-semibold text-fog-600">
              Enter to set · Esc to cancel
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setIntentText(data.intent?.text ?? "");
              setEditingIntent(true);
            }}
            className="press relative w-full overflow-hidden rounded-2xl border border-white/5 bg-ink-800 p-4 text-left"
          >
            <div className="absolute left-0 top-0 h-full w-[3px] bg-gradient-to-b from-ember-300 to-ember-600" />
            <div className="flex items-center gap-1.5 pl-2">
              <SparkIcon width={12} height={12} className="text-ember-400" />
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-fog-500">
                One thing
              </span>
              <PencilIcon
                width={11}
                height={11}
                className="ml-auto text-fog-600"
              />
            </div>
            <p className="mt-1.5 pl-2 font-display text-[17px] font-semibold leading-snug text-bone-50">
              {data.intent?.text ??
                "Decide the one thing that makes today a win."}
            </p>
          </button>
        )}
      </section>

      {/* Stack */}
      <section id="today-stack" className="mt-8 scroll-mt-4 px-5">
        <SectionLabel
          right={
            <span className="text-[11px] font-bold text-fog-500">
              {open.length} open · {doneItems.length} done
            </span>
          }
        >
          Today&rsquo;s stack
        </SectionLabel>

        {todays.length === 0 ? (
          <EmptyState
            title="Clean sheet"
            sub="Nothing planned yet. Tap + to claim the day."
          />
        ) : (
          <div className="space-y-5">
            {todays.length > 0 && open.length === 0 ? (
              <div className="flex items-center gap-3 rounded-xl border border-mint-500/20 bg-mint-500/10 px-4 py-3">
                <SparkIcon width={16} height={16} className="text-mint-400" />
                <div>
                  <p className="text-[13px] font-bold text-mint-400">
                    Clean sheet
                  </p>
                  <p className="text-[11.5px] font-medium text-fog-400">
                    Every task closed. Earn the rest.
                  </p>
                </div>
              </div>
            ) : null}

            {grouped.map((g) => (
              <div key={g.p}>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`size-1.5 rounded-full ${PRIORITY_META[g.p].dot}`}
                  />
                  <span
                    className={`text-[10.5px] font-bold uppercase tracking-[0.16em] ${PRIORITY_META[g.p].text}`}
                  >
                    {PRIORITY_META[g.p].label}
                  </span>
                  <span className="h-px flex-1 bg-white/5" />
                </div>
                <div className="space-y-2">
                  {g.items.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      onToggle={toggleTask}
                      onOpen={editTaskSheet}
                    />
                  ))}
                </div>
              </div>
            ))}

            {doneItems.length > 0 ? (
              <div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-mint-500" />
                  <span className="text-[10.5px] font-bold uppercase tracking-[0.16em] text-mint-400">
                    Closed out
                  </span>
                  <span className="h-px flex-1 bg-white/5" />
                </div>
                <div className="space-y-2">
                  {doneItems.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      onToggle={toggleTask}
                      onOpen={editTaskSheet}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </section>

      <div className="h-8" />
    </div>
  );
}
