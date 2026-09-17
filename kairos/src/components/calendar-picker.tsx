"use client";

import { useEffect, useState } from "react";
import {
  addDays,
  addMonths,
  dayNum,
  fmtShort,
  fromISO,
  monthGrid,
  monthLabel,
  todayISO,
  toISO,
  weekOf,
} from "@/lib/dates";
import { ChevronLeftIcon, ChevronRightIcon } from "./icons";

type View = "week" | "month" | "year";

const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

export function CalendarPicker({
  value,
  onChange,
  allowPast,
  taskDays,
}: {
  value: string;
  onChange: (iso: string) => void;
  allowPast: boolean;
  taskDays: Set<string>;
}) {
  const today = todayISO();
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState(value);

  useEffect(() => {
    setCursor(value);
  }, [value]);

  const isDisabled = (iso: string) => !allowPast && iso < today;
  const pick = (iso: string) => {
    if (isDisabled(iso)) return;
    onChange(iso);
  };

  const nav = (dir: 1 | -1) => {
    if (view === "month") setCursor(addMonths(cursor, dir));
    else if (view === "week") setCursor(addDays(cursor, dir * 7));
    else setCursor(addMonths(cursor, dir * 12));
  };

  const wk = weekOf(cursor);
  const label =
    view === "month"
      ? monthLabel(cursor)
      : view === "week"
        ? `${fmtShort(wk[0])} – ${fmtShort(wk[6])}`
        : String(fromISO(cursor).getFullYear());

  const navBtn =
    "press flex size-8 items-center justify-center rounded-full bg-ink-750 text-fog-400";

  return (
    <div className="rounded-2xl border border-white/5 bg-ink-800/60 p-3">
      {/* Nav row */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => nav(-1)} className={navBtn} aria-label="Earlier">
          <ChevronLeftIcon width={15} height={15} />
        </button>
        <p className="font-display text-[14px] font-bold text-bone-50">{label}</p>
        <button type="button" onClick={() => nav(1)} className={navBtn} aria-label="Later">
          <ChevronRightIcon width={15} height={15} />
        </button>
      </div>

      {/* View toggle + today */}
      <div className="mt-2.5 flex items-center justify-between">
        <div className="flex rounded-lg bg-ink-750 p-0.5">
          {(["week", "month", "year"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`rounded-md px-3 py-1 text-[10.5px] font-bold uppercase tracking-wide ${
                view === v ? "bg-bone-50 text-ink-950" : "text-fog-500"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => {
            setCursor(today);
            pick(today);
          }}
          className="press rounded-full border border-white/8 bg-ink-750 px-3 py-1 text-[10.5px] font-bold text-bone-300"
        >
          Today
        </button>
      </div>

      {/* Month view */}
      {view === "month" ? (
        <div className="mt-3">
          <div className="mb-1 grid grid-cols-7 gap-1">
            {WEEK_LETTERS.map((l, i) => (
              <span
                key={i}
                className="text-center text-[9px] font-bold uppercase text-fog-600"
              >
                {l}
              </span>
            ))}
          </div>
          <div className="space-y-1">
            {monthGrid(cursor).map((row, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-1">
                {row.map((d, di) =>
                  d === null ? (
                    <div key={di} />
                  ) : (
                    <button
                      key={d}
                      type="button"
                      disabled={isDisabled(d)}
                      onClick={() => pick(d)}
                      className={`relative flex h-10 flex-col items-center justify-center rounded-xl transition-colors ${
                        d === value
                          ? "bg-bone-50 text-ink-950"
                          : isDisabled(d)
                            ? "text-fog-600/35"
                            : d === today
                              ? "text-ember-400"
                              : "text-bone-300 active:bg-white/5"
                      } ${d === today && d !== value ? "ring-1 ring-ember-500/35" : ""}`}
                    >
                      <span className="font-display text-[13.5px] font-bold">
                        {dayNum(d)}
                      </span>
                      {taskDays.has(d) ? (
                        <span
                          className={`absolute bottom-1 size-1 rounded-full ${
                            d === value ? "bg-ink-950/70" : "bg-ember-400"
                          }`}
                        />
                      ) : null}
                    </button>
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Week view */}
      {view === "week" ? (
        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {wk.map((d) => (
            <button
              key={d}
              type="button"
              disabled={isDisabled(d)}
              onClick={() => pick(d)}
              className={`flex h-[68px] flex-col items-center justify-center gap-1 rounded-xl border transition-colors ${
                d === value
                  ? "border-transparent bg-bone-50 text-ink-950"
                  : isDisabled(d)
                    ? "border-white/5 bg-ink-750 text-fog-600/35"
                    : "border-white/5 bg-ink-750 text-bone-300"
              }`}
            >
              <span
                className={`text-[9px] font-bold uppercase ${
                  d === value ? "text-ink-950/60" : d === today ? "text-ember-400" : "text-fog-500"
                }`}
              >
                {WEEK_LETTERS[(weekOf(d).indexOf(d) + 7) % 7]}
              </span>
              <span className="font-display text-[17px] font-bold">{dayNum(d)}</span>
              <span className="flex h-1 items-center gap-0.5">
                {taskDays.has(d) ? (
                  <span
                    className={`size-1 rounded-full ${
                      d === value ? "bg-ink-950/70" : "bg-ember-400"
                    }`}
                  />
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}

      {/* Year view */}
      {view === "year" ? (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {Array.from({ length: 12 }).map((_, m) => {
            const iso = toISO(new Date(fromISO(cursor).getFullYear(), m, 1));
            const ym = iso.slice(0, 7);
            const count = [...taskDays].filter((d) => d.startsWith(ym)).length;
            const isPastMonth = !allowPast && ym < today.slice(0, 7);
            return (
              <button
                key={ym}
                type="button"
                onClick={() => {
                  setCursor(iso);
                  setView("month");
                }}
                className={`flex h-14 flex-col items-center justify-center gap-1 rounded-xl border border-white/5 transition-colors active:bg-white/5 ${
                  isPastMonth ? "bg-ink-750 opacity-40" : "bg-ink-750"
                }`}
              >
                <span className="text-[11px] font-bold text-bone-300">
                  {fromISO(iso).toLocaleDateString("en-US", { month: "short" })}
                </span>
                <span className="flex h-1 items-center gap-0.5">
                  {count > 0 ? (
                    <>
                      {Array.from({ length: Math.min(count, 3) }).map((_, i) => (
                        <span key={i} className="size-1 rounded-full bg-ember-400" />
                      ))}
                      {count > 3 ? (
                        <span className="ml-0.5 text-[8px] font-bold text-ember-400">
                          {count}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
