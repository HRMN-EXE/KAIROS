"use client";

import { useMemo, useState } from "react";
import {
  dayNum,
  fmtLong,
  todayISO,
  weekdayLetter,
  weekOf,
} from "@/lib/dates";
import { PRIORITY_META, tagClasses, type TaskInput } from "@/lib/types";
import { useApp, type TaskSheetState } from "./app-context";
import { CalendarPicker } from "./calendar-picker";
import { CalendarIcon, ChevronRightIcon, TrashIcon } from "./icons";
import { FieldLabel, Seg, Sheet } from "./ui";

export function TaskSheet({
  state,
  onClose,
}: {
  state: TaskSheetState;
  onClose: () => void;
}) {
  if (!state) return null;
  const key = state.mode === "edit" ? `edit-${state.task.id}` : "create";
  return <TaskSheetInner key={key} state={state} onClose={onClose} />;
}

function TaskSheetInner({
  state,
  onClose,
}: {
  state: Exclude<TaskSheetState, null>;
  onClose: () => void;
}) {
  const { data, addTask, updateTask, deleteTask, addTag } = useApp();
  const editing = state.mode === "edit" ? state.task : null;
  const today = todayISO();
  /** Past dates are only selectable when editing (task history), never on create. */
  const allowPast = editing !== null;

  const [title, setTitle] = useState(editing?.title ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");
  const [tagComposerOpen, setTagComposerOpen] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [day, setDay] = useState(() => {
    const initial =
      editing?.day ?? (state.mode === "create" ? state.day : today);
    return allowPast || initial >= today ? initial : today;
  });
  const [time, setTime] = useState(editing?.time ?? "");
  const [priority, setPriority] = useState(editing?.priority ?? 2);
  const [tag, setTag] = useState(editing?.tag ?? "personal");
  const [calOpen, setCalOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const taskDays = useMemo(
    () => new Set(data.tasks.map((t) => t.day)),
    [data.tasks]
  );

  const weekOptions = useMemo(() => weekOf(today), [today]);

  async function save() {
    if (!title.trim() || busy) return;
    setBusy(true);
    const input: TaskInput = {
      title: title.trim(),
      notes: notes.trim(),
      day,
      time: time || null,
      priority,
      tag,
    };
    try {
      if (editing) await updateTask(editing.id, input);
      else await addTask(input);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editing || busy) return;
    setBusy(true);
    try {
      await deleteTask(editing.id);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function createTag() {
    const name = await addTag(newTagName);
    if (name) {
      setTag(name);
      setNewTagName("");
      setTagComposerOpen(false);
    }
  }

  return (
    <Sheet open title={editing ? "Edit task" : "New task"} onClose={onClose}>
      <input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
        }}
        placeholder="What needs doing?"
        className="w-full rounded-xl bg-ink-750 px-4 py-3.5 text-[15px] font-semibold text-bone-50 outline-none ring-ember-500/50 placeholder:text-fog-600 focus:ring-2"
      />

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <FieldLabel>Day</FieldLabel>
          {!allowPast ? (
            <span className="text-[9.5px] font-bold uppercase tracking-wider text-fog-600">
              Past dates locked
            </span>
          ) : null}
        </div>

        <p className="font-display text-[15px] font-bold text-bone-50">
          {fmtLong(day)}
        </p>

        <div className="mt-2.5 grid grid-cols-7 gap-1.5">
          {weekOptions.map((d) => {
            const sel = d === day;
            const past = d < today && !allowPast;
            return (
              <button
                key={d}
                type="button"
                disabled={past}
                onClick={() => setDay(d)}
                className={`press flex flex-col items-center gap-0.5 rounded-xl py-2 ${
                  sel
                    ? "bg-bone-50 text-ink-950"
                    : past
                      ? "bg-ink-750/50 text-fog-600/40"
                      : "bg-ink-750 text-bone-300"
                }`}
              >
                <span
                  className={`text-[9px] font-bold uppercase ${
                    sel
                      ? "text-ink-950/60"
                      : d === today
                        ? "text-ember-400"
                        : "text-fog-500"
                  }`}
                >
                  {weekdayLetter(d)}
                </span>
                <span className="font-display text-[14px] font-bold">
                  {dayNum(d)}
                </span>
                <span className="h-3 text-[8px] font-bold uppercase text-fog-600">
                  {d === today ? "now" : ""}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setCalOpen((o) => !o)}
          className="press mt-2.5 flex w-full items-center justify-between rounded-xl border border-white/5 bg-ink-750 px-4 py-3"
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
              value={day}
              onChange={(iso) => setDay(iso)}
              allowPast={allowPast}
              taskDays={taskDays}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        <FieldLabel>Time block</FieldLabel>
        <div className="flex items-center gap-2">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="flex-1 rounded-xl bg-ink-750 px-4 py-2.5 font-display text-[14px] font-semibold text-bone-100 outline-none"
          />
          {time ? (
            <button
              type="button"
              onClick={() => setTime("")}
              className="press rounded-xl bg-ink-750 px-3.5 py-2.5 text-[12px] font-bold text-fog-400"
            >
              Clear
            </button>
          ) : null}
        </div>
        {time ? (
          <p className="mt-1.5 text-[10.5px] font-semibold text-fog-600">
            Reminder 5 min before · alarm 2 min before
          </p>
        ) : null}
      </div>

      <div className="mt-5">
        <FieldLabel>Priority</FieldLabel>
        <Seg
          value={priority}
          onChange={(v) => setPriority(v)}
          options={[1, 2, 3].map((n) => ({
            value: n,
            label: (
              <span className="flex items-center gap-1.5">
                <span
                  className={`size-1.5 rounded-full ${PRIORITY_META[n].dot}`}
                />
                {PRIORITY_META[n].label}
              </span>
            ),
          }))}
        />
        <p className="mt-1.5 text-[10.5px] font-semibold text-fog-600">
          Must &amp; Should count toward your day streak. Could never does.
        </p>
      </div>

      <div className="mt-5">
        <FieldLabel>Tag</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {data.tags.map((t) => (
            <button
              key={t.name}
              type="button"
              onClick={() => setTag(t.name)}
              className={`press rounded-full px-3.5 py-1.5 text-[12px] font-bold capitalize transition-colors ${
                tag === t.name
                  ? "bg-bone-50 text-ink-950"
                  : `${tagClasses(t.name, data.tags)} opacity-80`
              }`}
            >
              {t.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTagComposerOpen((o) => !o)}
            className="press rounded-full border border-dashed border-fog-600 px-3.5 py-1.5 text-[12px] font-bold text-fog-400"
          >
            + New
          </button>
        </div>
        {tagComposerOpen ? (
          <div className="mt-2.5 flex gap-2">
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void createTag();
              }}
              placeholder="New tag name…"
              className="min-w-0 flex-1 rounded-xl bg-ink-750 px-3.5 py-2.5 text-[13px] font-semibold text-bone-100 outline-none ring-ember-500/50 placeholder:text-fog-600 focus:ring-2"
            />
            <button
              type="button"
              disabled={!newTagName.trim()}
              onClick={() => void createTag()}
              className="press rounded-xl bg-ember-500 px-4 text-[12.5px] font-extrabold text-ink-950 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        <FieldLabel>Notes</FieldLabel>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Optional context…"
          className="w-full resize-none rounded-xl bg-ink-750 px-4 py-3 text-[13.5px] font-medium text-bone-100 outline-none placeholder:text-fog-600"
        />
      </div>

      <div className="mt-4 flex gap-2">
        {editing && !editing.done && editing.ritualInstanceId === null ? (
          <button
            type="button"
            onClick={() => void remove()}
            className="press flex size-12 shrink-0 items-center justify-center rounded-xl border border-coral-400/25 bg-coral-400/10 text-coral-400"
            aria-label="Delete task"
          >
            <TrashIcon width={17} height={17} />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void save()}
          disabled={!title.trim() || busy}
          className="press h-12 flex-1 rounded-xl bg-ember-500 text-[15px] font-extrabold text-ink-950 transition-opacity disabled:opacity-40"
        >
          {busy ? "Saving…" : editing ? "Save changes" : "Add to plan"}
        </button>
      </div>
      {editing?.ritualInstanceId ? (
        <p className="mt-2.5 text-center text-[10.5px] font-semibold text-fog-600">
          Ritual tasks are managed in the Rituals tab — they can't be deleted here.
        </p>
      ) : editing?.done ? (
        <p className="mt-2.5 text-center text-[10.5px] font-semibold text-fog-600">
          Completed tasks are final — they can't be unchecked or deleted.
        </p>
      ) : null}
    </Sheet>
  );
}
