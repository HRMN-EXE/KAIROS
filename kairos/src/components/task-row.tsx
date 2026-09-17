"use client";

import { fmtTime, todayISO } from "@/lib/dates";
import { PRIORITY_META, tagClasses, type TaskDTO } from "@/lib/types";
import { useApp } from "./app-context";
import { CheckIcon, ClockIcon } from "./icons";

export function TaskRow({
  task,
  onToggle,
  onOpen,
}: {
  task: TaskDTO;
  onToggle: (id: number) => void;
  onOpen: (task: TaskDTO) => void;
}) {
  const { data } = useApp();
  const p = PRIORITY_META[task.priority] ?? PRIORITY_META[2];
  // Completed work is final — no unchecking, any task, any screen.
  // Ritual instances additionally complete ONLY on their due date: future
  // days are schedule, not controls; past days go through carry/miss.
  const locked =
    task.done ||
    (task.ritualInstanceId !== null && task.day !== todayISO());
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border border-white/5 bg-ink-800 px-3.5 py-3 transition-opacity ${
        task.done ? "opacity-50" : ""
      }`}
    >
      <button
        type="button"
        aria-label={task.done ? "Completed — final" : "Mark as done"}
        disabled={locked}
        title={
          locked
            ? task.done
              ? "Completed tasks are final"
              : task.ritualInstanceId !== null && task.day > todayISO()
                ? "Upcoming — ritual instances can't be completed in advance"
                : "Past instance — resolve via carry forward or mark missed"
            : undefined
        }
        onClick={() => onToggle(task.id)}
        className={`flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
          locked && !task.done ? "opacity-35" : ""
        } ${task.done ? "cursor-default" : "press"} ${
          task.done
            ? "border-mint-500 bg-mint-500 text-ink-950"
            : `${p.border} bg-transparent text-transparent`
        }`}
      >
        {task.done && (
          <CheckIcon width={12} height={12} strokeWidth={3.4} className="animate-pop" />
        )}
      </button>

      <button
        type="button"
        onClick={() => onOpen(task)}
        className="min-w-0 flex-1 text-left"
      >
        <p
          className={`truncate text-[14px] font-semibold leading-tight ${
            task.done
              ? "text-fog-500 line-through decoration-fog-600"
              : "text-bone-100"
          }`}
        >
          {task.title}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          <span
            className={`rounded-md px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide ${tagClasses(
              task.tag,
              data.tags
            )}`}
          >
            {task.tag}
          </span>
          {task.missed ? (
            <span className="rounded-md bg-coral-400/10 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-coral-400">
              missed
            </span>
          ) : null}
          {task.carries > 0 && !task.missed && !task.done ? (
            <span className="rounded-md bg-white/5 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-fog-400">
              carried ×{task.carries}
            </span>
          ) : null}
          {task.notes ? (
            <span className="truncate text-[11px] font-medium text-fog-500">
              {task.notes}
            </span>
          ) : null}
        </div>
      </button>

      {task.time ? (
        <span className="flex shrink-0 items-center gap-1 font-display text-[11px] font-semibold text-fog-400">
          <ClockIcon width={12} height={12} />
          {fmtTime(task.time)}
        </span>
      ) : null}
    </div>
  );
}
