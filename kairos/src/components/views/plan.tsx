"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  dayNum,
  fmtFull,
  todayISO,
  weekOf,
  weekdayLetter,
} from "@/lib/dates";
import type { TaskDTO } from "@/lib/types";
import { useApp } from "../app-context";
import { CalendarPicker } from "../calendar-picker";
import {
  CalendarIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlusIcon,
} from "../icons";
import { TaskRow } from "../task-row";
import { EmptyState } from "../ui";

const openFirst = (a: TaskDTO, b: TaskDTO) => {
  if (a.done !== b.done) return a.done ? 1 : -1;
  return (
    (a.time ?? "99:99").localeCompare(b.time ?? "99:99") ||
    a.priority - b.priority
  );
};

export function PlanView() {
  const { data, toggleTask, editTaskSheet, openTaskSheet, updateTask, toast } =
    useApp();
  const today = todayISO();
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState(today);
  const [calOpen, setCalOpen] = useState(false);

  const days = useMemo(() => weekOf(anchor), [anchor]);
  const taskDays = useMemo(
    () => new Set(data.tasks.map((t) => t.day)),
    [data.tasks]
  );
  const tasksFor = (d: string) => data.tasks.filter((t) => t.day === d);
  const sel = useMemo(
    () => tasksFor(selected).sort(openFirst),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.tasks, selected]
  );
  const openSel = sel.filter((t) => !t.done);

  async function catchUp() {
    const targets = openSel;
    if (targets.length === 0) return;
    await Promise.all(
      targets.map((t) => updateTask(t.id, { day: today }))
    );
    toast(
      `${targets.length} ${targets.length === 1 ? "task" : "tasks"} pulled to today`
    );
  }

  return (
    <div className="animate-rise">
      <header className="px-5 pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-[24px] font-bold text-bone-50">
              Planner
            </h1>
            <p className="mt-0.5 text-[11.5px] font-semibold text-fog-500">
              The week, on your terms
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setAnchor(addDays(anchor, -7))}
              className="press flex size-9 items-center justify-center rounded-full border border-white/8 bg-ink-800 text-fog-400"
              aria-label="Previous week"
            >
              <ChevronLeftIcon width={15} height={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                setAnchor(today);
                setSelected(today);
              }}
              className="press rounded-full border border-white/8 bg-ink-800 px-3.5 py-2 text-[11.5px] font-bold text-bone-300"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setAnchor(addDays(anchor, 7))}
              className="press flex size-9 items-center justify-center rounded-full border border-white/8 bg-ink-800 text-fog-400"
              aria-label="Next week"
            >
              <ChevronRightIcon width={15} height={15} />
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const n = tasksFor(d).filter((t) => !t.done).length;
            const isSel = d === selected;
            const isToday = d === today;
            // Past days are locked — nothing can be selected or added there.
            const isPast = d < today;
            return (
              <button
                key={d}
                type="button"
                disabled={isPast}
                title={isPast ? "Past days are locked" : undefined}
                onClick={() => setSelected(d)}
                className={`flex flex-col items-center gap-1 rounded-xl border py-2.5 transition-colors ${
                  isPast
                    ? "cursor-not-allowed border-white/5 bg-ink-800/40 opacity-45"
                    : isSel
                      ? "press border-transparent bg-bone-50"
                      : "press border-white/5 bg-ink-800"
                }`}
              >
                <span
                  className={`text-[9px] font-bold uppercase ${
                    isSel
                      ? "text-ink-950/60"
                      : isToday
                        ? "text-ember-400"
                        : "text-fog-500"
                  }`}
                >
                  {weekdayLetter(d)}
                </span>
                <span
                  className={`font-display text-[15px] font-bold ${
                    isSel
                      ? "text-ink-950"
                      : isToday
                        ? "text-ember-400"
                        : "text-bone-100"
                  }`}
                >
                  {dayNum(d)}
                </span>
                <span className="flex h-1 items-center gap-0.5">
                  {Array.from({ length: Math.min(n, 3) }).map((_, i) => (
                    <span
                      key={i}
                      className={`size-1 rounded-full ${
                        isSel ? "bg-ink-950/70" : "bg-ember-500"
                      }`}
                    />
                  ))}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setCalOpen((o) => !o)}
          className="press mt-2.5 flex w-full items-center justify-between rounded-xl border border-white/5 bg-ink-800 px-4 py-3"
        >
          <span className="flex items-center gap-2 text-[12.5px] font-bold text-bone-300">
            <CalendarIcon width={15} height={15} className="text-ember-400" />
            Full calendar — any month, any year
          </span>
          <ChevronRightIcon
            width={14}
            height={14}
            className={`text-fog-500 transition-transform ${calOpen ? "rotate-90" : ""}`}
          />
        </button>

        {calOpen ? (
          <div className="mt-2.5 animate-rise">
            <CalendarPicker
              value={selected}
              onChange={(iso) => {
                setSelected(iso);
                setAnchor(iso);
              }}
              allowPast={false}
              taskDays={taskDays}
            />
          </div>
        ) : null}
      </header>

      <section className="mt-6 px-5 pb-8">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="font-display text-[16px] font-bold text-bone-50">
              {selected === today ? "Today" : fmtFull(selected)}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-fog-500">
              {openSel.length} open · {sel.length - openSel.length} done
            </p>
          </div>
          <button
            type="button"
            onClick={() => openTaskSheet(selected)}
            className="press flex h-9 items-center gap-1 rounded-full bg-ember-500 px-3.5 text-[12.5px] font-extrabold text-ink-950"
          >
            <PlusIcon width={14} height={14} strokeWidth={2.6} />
            Add
          </button>
        </div>

        {selected < today && openSel.length > 0 ? (
          <button
            type="button"
            onClick={() => void catchUp()}
            className="press mb-3 w-full rounded-xl border border-ember-500/25 bg-ember-500/10 px-4 py-3 text-[12.5px] font-bold text-ember-400"
          >
            Pull {openSel.length} open{" "}
            {openSel.length === 1 ? "task" : "tasks"} to today ↴
          </button>
        ) : null}

        {sel.length === 0 ? (
          <EmptyState
            title="Nothing scheduled"
            sub="This day is wide open. Add something worth doing."
          />
        ) : (
          <div className="space-y-2">
            {sel.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                onToggle={toggleTask}
                onOpen={editTaskSheet}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
