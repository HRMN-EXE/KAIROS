"use client";

import { useMemo } from "react";
import {
  addDays,
  fmtClock,
  fmtShort,
  todayISO,
  toISO,
  weekdayLetter,
} from "@/lib/dates";
import { tagClasses } from "@/lib/types";
import { useApp } from "../app-context";
import { FlameIcon, TimerIcon } from "../icons";
import { SectionLabel } from "../ui";

function streakFor(days: Set<string>): number {
  let n = 0;
  const d = new Date();
  if (!days.has(toISO(d))) d.setDate(d.getDate() - 1);
  while (days.has(toISO(d))) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function StatsView() {
  const { data, profileName, openedOn } = useApp();
  // The ledger shows exactly 7 days starting from the login day —
  // not a Monday–Sunday calendar week, never anything before login.
  const week = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(openedOn, i)),
    [openedOn]
  );
  const inWeek = (dt: string) => week.includes(dt.slice(0, 10));
  const since = (dt: string) => dt.slice(0, 10) >= openedOn;

  const closedPerDay = week.map(
    (d) =>
      data.tasks.filter(
        (t) => t.done && (t.doneAt?.slice(0, 10) ?? t.day) === d
      ).length
  );
  const closedWeek = closedPerDay.reduce((a, b) => a + b, 0);
  const maxDay = Math.max(...closedPerDay, 1);

  const scheduledWeek = data.tasks.filter((t) => week.includes(t.day));
  const rate = scheduledWeek.length
    ? Math.round(
        (scheduledWeek.filter((t) => t.done).length / scheduledWeek.length) *
          100
      )
    : 0;

  const weekSessions = data.sessions.filter(
    (s) => inWeek(s.startedAt) && since(s.startedAt)
  );
  const focusMin = weekSessions.reduce((a, s) => a + s.durationMin, 0);

  const bestStreak = Math.max(
    0,
    ...data.habits.map((h) =>
      streakFor(
        new Set(
          data.logs
            .filter((l) => l.habitId === h.id && since(l.day))
            .map((l) => l.day)
        )
      )
    )
  );

  const tagCounts = Object.entries(
    data.tasks
      .filter((t) => t.done && inWeek(t.doneAt ?? `${t.day}T00:00`))
      .reduce<Record<string, number>>((acc, t) => {
        acc[t.tag] = (acc[t.tag] ?? 0) + 1;
        return acc;
      }, {})
  ).sort((a, b) => b[1] - a[1]);
  const maxTag = Math.max(0, ...tagCounts.map(([, n]) => n), 1);

  const fmtDur = (min: number) =>
    min >= 60 ? `${Math.floor(min / 60)}h ${pad(min % 60)}m` : `${min}m`;

  return (
    <div className="animate-rise">
      <header className="px-5 pt-6">
        <h1 className="font-display text-[24px] font-bold text-bone-50">
          {profileName ? `${profileName}'s Ledger` : "Ledger"}
        </h1>
        <p className="mt-0.5 text-[11.5px] font-semibold text-fog-500">
          First 7 days · {fmtShort(week[0])} – {fmtShort(week[6])}
        </p>
      </header>

      <section className="mt-5 grid grid-cols-2 gap-2.5 px-5">
        <div className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-fog-500">
            Closed
          </p>
          <p className="mt-1.5 font-display text-[30px] font-bold leading-none text-bone-50">
            {closedWeek}
          </p>
          <p className="mt-1 text-[10.5px] font-semibold text-fog-500">
            tasks this week
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-fog-500">
            Deep focus
          </p>
          <p className="mt-1.5 font-display text-[30px] font-bold leading-none text-bone-50">
            {fmtDur(focusMin)}
          </p>
          <p className="mt-1 text-[10.5px] font-semibold text-fog-500">
            {weekSessions.length} session{weekSessions.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          <div className="flex items-center gap-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-fog-500">
              Best streak
            </p>
            <FlameIcon width={11} height={11} className="text-ember-400" />
          </div>
          <p className="mt-1.5 font-display text-[30px] font-bold leading-none text-bone-50">
            {bestStreak}
          </p>
          <p className="mt-1 text-[10.5px] font-semibold text-fog-500">
            days in a row
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-fog-500">
            Close rate
          </p>
          <p className="mt-1.5 font-display text-[30px] font-bold leading-none text-bone-50">
            {rate}%
          </p>
          <p className="mt-1 text-[10.5px] font-semibold text-fog-500">
            of scheduled work
          </p>
        </div>
      </section>

      <section className="mt-4 px-5">
        <div className="rounded-2xl border border-white/5 bg-ink-800 p-4">
          <SectionLabel>Closed per day</SectionLabel>
          <div className="flex h-28 items-end gap-2">
            {week.map((d, i) => {
              const n = closedPerDay[i];
              const isToday = d === todayISO();
              return (
                <div
                  key={d}
                  className="flex flex-1 flex-col items-center justify-end gap-1"
                >
                  <span className="font-display text-[10px] font-bold text-fog-400">
                    {n > 0 ? n : ""}
                  </span>
                  <div
                    className={`w-full rounded-md transition-all duration-500 ${
                      isToday
                        ? "bg-gradient-to-t from-ember-600 to-ember-300"
                        : n > 0
                          ? "bg-ink-700"
                          : "bg-ink-750"
                    }`}
                    style={{ height: Math.max(5, (n / maxDay) * 72) }}
                  />
                  <span
                    className={`text-[9px] font-bold uppercase ${
                      isToday ? "text-ember-400" : "text-fog-600"
                    }`}
                  >
                    {weekdayLetter(d)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {tagCounts.length > 0 ? (
        <section className="mt-4 px-5">
          <div className="rounded-2xl border border-white/5 bg-ink-800 p-4">
            <SectionLabel>Where the work went</SectionLabel>
            <div className="space-y-2.5">
              {tagCounts.map(([tag, n]) => (
                <div key={tag} className="flex items-center gap-3">
                  <span
                    className={`w-20 shrink-0 truncate rounded-md px-1.5 py-0.5 text-center text-[9.5px] font-bold uppercase tracking-wide ${tagClasses(
                      tag,
                      data.tags
                    )}`}
                  >
                    {tag}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-ember-500 to-ember-300"
                      style={{ width: `${(n / maxTag) * 100}%` }}
                    />
                  </div>
                  <span className="w-4 text-right font-display text-[12px] font-bold text-bone-300">
                    {n}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mt-4 px-5 pb-8">
        <SectionLabel>Latest sessions</SectionLabel>
        {data.sessions.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 bg-ink-800/40 px-5 py-6 text-center text-[12px] font-medium text-fog-500">
            Focus sessions will show up here.
          </p>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/5 bg-ink-800">
            {data.sessions.slice(0, 5).map((s, i) => (
              <div
                key={s.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i > 0 ? "border-t border-white/5" : ""
                }`}
              >
                <span className="flex size-8 items-center justify-center rounded-lg bg-ember-500/10 text-ember-400">
                  <TimerIcon width={14} height={14} />
                </span>
                <p className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-bone-100">
                  {s.label}
                </p>
                <span className="text-[10.5px] font-semibold text-fog-500">
                  {fmtShort(s.startedAt.slice(0, 10))} · {fmtClock(s.startedAt)}
                </span>
                <span className="w-9 text-right font-display text-[12.5px] font-bold text-bone-300">
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
