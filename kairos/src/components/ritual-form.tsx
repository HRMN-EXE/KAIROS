"use client";

import { useState } from "react";
import {
  PRIORITY_META,
  TAGS,
  TAG_META,
} from "@/lib/types";
import {
  WEEKDAY_SHORT,
  type RitualCreateInput,
  type ScheduleConfig,
  type ScheduleType,
  type TenureUnit,
} from "@/lib/ritual-meta";
import { useApp } from "./app-context";
import { HABIT_ICONS } from "@/lib/types";
import { FieldLabel, Seg, Sheet } from "./ui";

export type RitualFormState =
  | { mode: "create" }
  | { mode: "edit"; ritualId: number }
  | null;

const TENURE_PRESETS: { value: number; unit: TenureUnit; label: string }[] = [
  { value: 1, unit: "MONTH", label: "1 month" },
  { value: 3, unit: "MONTH", label: "3 months" },
  { value: 6, unit: "MONTH", label: "6 months" },
  { value: 1, unit: "YEAR", label: "1 year" },
];

const FREQ_OPTIONS: { type: ScheduleType; label: string }[] = [
  { type: "daily", label: "Daily" },
  { type: "weekdays", label: "Weekdays" },
  { type: "days", label: "Specific days" },
  { type: "flex_week", label: "N× / week (flex)" },
  { type: "every_n", label: "Every N days" },
  { type: "monthly", label: "Monthly" },
];

export function RitualFormSheet({
  state,
  ritual,
  onClose,
}: {
  state: RitualFormState;
  ritual: import("@/lib/ritual-meta").RitualDTO | null;
  onClose: () => void;
}) {
  if (!state) return null;
  return (
    <RitualFormInner
      key={state.mode === "edit" ? `edit-${state.ritualId}` : "create"}
      mode={state.mode}
      ritual={ritual}
      onClose={onClose}
    />
  );
}

function RitualFormInner({
  mode,
  ritual,
  onClose,
}: {
  mode: "create" | "edit";
  ritual: import("@/lib/ritual-meta").RitualDTO | null;
  onClose: () => void;
}) {
  const { createRitual, ritualAction, toast } = useApp();
  const editing = mode === "edit" && ritual ? ritual : null;

  const [name, setName] = useState(editing?.name ?? "");
  const [icon, setIcon] = useState(editing?.icon ?? HABIT_ICONS[0]);
  const [category, setCategory] = useState(editing?.category ?? "health");
  const [priority, setPriority] = useState(editing?.schedule.priority ?? 2);
  const [scheduleType, setScheduleType] = useState<ScheduleType>(
    editing?.schedule.type ?? "days"
  );
  const [days, setDays] = useState<number[]>(
    editing?.schedule.config.days ?? [0, 2, 4]
  );
  const [flexN, setFlexN] = useState(editing?.schedule.config.n ?? 3);
  const [everyN, setEveryN] = useState(editing?.schedule.config.every ?? 2);
  const [monthDay, setMonthDay] = useState(editing?.schedule.config.monthDay ?? 1);
  const [time, setTime] = useState(editing?.schedule.config.time ?? "");
  const [tenure, setTenure] = useState<number>(2); // preset index, 4 = custom
  const [customDays, setCustomDays] = useState(45);
  const [vacBehavior, setVacBehavior] = useState<"pause" | "continue">(
    (editing?.commitment.vacationBehavior as "pause" | "continue") ?? "pause"
  );
  const [busy, setBusy] = useState(false);
  const [dup, setDup] = useState<{ id: number; name: string } | null>(null);

  function buildConfig(): ScheduleConfig {
    const config: ScheduleConfig = { time: time || null };
    if (scheduleType === "days") config.days = [...days].sort();
    if (scheduleType === "flex_week") config.n = flexN;
    if (scheduleType === "every_n") config.every = everyN;
    if (scheduleType === "monthly") config.monthDay = monthDay;
    return config;
  }

  async function submit(force = false) {
    if (!name.trim() || busy) return;
    setBusy(true);
    setDup(null);
    try {
      if (mode === "create") {
        const preset = TENURE_PRESETS[tenure];
        const input: RitualCreateInput = {
          name: name.trim(),
          icon,
          category,
          priority,
          scheduleType,
          config: buildConfig(),
          tenureValue: tenure === 4 ? customDays : preset.value,
          tenureUnit: tenure === 4 ? "DAY" : preset.unit,
          vacationBehavior: vacBehavior,
        };
        const res = await createRitual(input, force);
        if (res?.duplicate) {
          setDup(res.duplicate);
          return;
        }
        onClose();
      } else if (editing) {
        await ritualAction(editing.id, "edit", {
          name: name.trim(),
          icon,
          category,
          priority,
          scheduleType,
          config: buildConfig(),
          vacationBehavior: vacBehavior,
        });
        toast("Ritual updated — new schedule version created");
        onClose();
      }
    } finally {
      setBusy(false);
    }
  }

  const dayChip = (i: number) => {
    const on = days.includes(i);
    return (
      <button
        key={i}
        type="button"
        onClick={() =>
          setDays((d) => (on ? d.filter((x) => x !== i) : [...d, i]))
        }
        className={`press flex-1 rounded-lg py-2 text-[11px] font-bold ${
          on ? "bg-bone-50 text-ink-950" : "bg-ink-750 text-fog-400"
        }`}
      >
        {WEEKDAY_SHORT[i]}
      </button>
    );
  };

  return (
    <Sheet
      open
      title={mode === "create" ? "Create ritual" : "Edit ritual"}
      onClose={onClose}
    >
      <p className="mb-4 text-[11.5px] font-medium leading-relaxed text-fog-500">
        {mode === "create"
          ? "A ritual is a time-bound practice. Define it once — KAIROS generates the daily obligations and feeds them to the streak engine."
          : "Schedule and priority changes create a new version from today. History keeps its original snapshots."}
      </p>

      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Name the ritual…"
        className="w-full rounded-xl bg-ink-750 px-4 py-3.5 text-[15px] font-semibold text-bone-50 outline-none ring-ember-500/50 placeholder:text-fog-600 focus:ring-2"
      />

      {dup ? (
        <div className="mt-3 rounded-xl border border-gold-400/25 bg-gold-400/10 p-3.5">
          <p className="text-[12.5px] font-bold text-gold-400">
            You already have an active “{dup.name}” ritual.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="press h-9 flex-1 rounded-lg bg-bone-50 text-[12px] font-extrabold text-ink-950"
            >
              Keep existing
            </button>
            <button
              type="button"
              onClick={() => void submit(true)}
              className="press h-9 flex-1 rounded-lg border border-white/10 bg-ink-750 text-[12px] font-bold text-bone-300"
            >
              Create separate
            </button>
          </div>
        </div>
      ) : null}

      <div className="mt-5">
        <FieldLabel>Mark</FieldLabel>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {HABIT_ICONS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcon(i)}
              className={`press flex size-10 shrink-0 items-center justify-center rounded-xl text-[17px] ${
                icon === i ? "bg-bone-50" : "bg-ink-750"
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <FieldLabel>Category</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {TAGS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setCategory(t)}
              className={`press rounded-full px-3.5 py-1.5 text-[12px] font-bold capitalize ${
                category === t ? "bg-bone-50 text-ink-950" : `${TAG_META[t]} opacity-80`
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <FieldLabel>Priority — feeds the streak engine</FieldLabel>
        <Seg
          value={priority}
          onChange={(v) => setPriority(v)}
          options={[1, 2, 3].map((n) => ({
            value: n,
            label: (
              <span className="flex items-center gap-1.5">
                <span className={`size-1.5 rounded-full ${PRIORITY_META[n].dot}`} />
                {PRIORITY_META[n].label}
              </span>
            ),
          }))}
        />
      </div>

      <div className="mt-5">
        <FieldLabel>Frequency</FieldLabel>
        <div className="flex flex-wrap gap-2">
          {FREQ_OPTIONS.map((f) => (
            <button
              key={f.type}
              type="button"
              onClick={() => setScheduleType(f.type)}
              className={`press rounded-full px-3.5 py-1.5 text-[12px] font-bold ${
                scheduleType === f.type
                  ? "bg-bone-50 text-ink-950"
                  : "bg-ink-750 text-fog-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {scheduleType === "days" ? (
          <div className="mt-2.5 flex gap-1.5">{[0, 1, 2, 3, 4, 5, 6].map(dayChip)}</div>
        ) : null}
        {scheduleType === "flex_week" ? (
          <div className="mt-2.5 flex items-center gap-3">
            <span className="text-[12px] font-bold text-fog-400">Target</span>
            <div className="flex gap-1.5">
              {[2, 3, 4, 5, 6].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setFlexN(n)}
                  className={`press size-9 rounded-lg font-display text-[13px] font-bold ${
                    flexN === n ? "bg-bone-50 text-ink-950" : "bg-ink-750 text-fog-400"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="text-[11px] font-semibold text-fog-500">
              any days each week
            </span>
          </div>
        ) : null}
        {scheduleType === "every_n" ? (
          <div className="mt-2.5 flex items-center gap-3">
            <span className="text-[12px] font-bold text-fog-400">Every</span>
            <input
              type="number"
              min={2}
              max={30}
              value={everyN}
              onChange={(e) => setEveryN(Math.max(2, Number(e.target.value) || 2))}
              className="w-20 rounded-lg bg-ink-750 px-3 py-2 text-center font-display text-[13px] font-bold text-bone-100 outline-none"
            />
            <span className="text-[12px] font-semibold text-fog-500">days</span>
          </div>
        ) : null}
        {scheduleType === "monthly" ? (
          <div className="mt-2.5 flex items-center gap-3">
            <span className="text-[12px] font-bold text-fog-400">Day</span>
            <input
              type="number"
              min={1}
              max={28}
              value={monthDay}
              onChange={(e) => setMonthDay(Math.min(28, Math.max(1, Number(e.target.value) || 1)))}
              className="w-20 rounded-lg bg-ink-750 px-3 py-2 text-center font-display text-[13px] font-bold text-bone-100 outline-none"
            />
            <span className="text-[12px] font-semibold text-fog-500">of each month</span>
          </div>
        ) : null}
      </div>

      <div className="mt-5">
        <FieldLabel>Time (optional)</FieldLabel>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-full rounded-xl bg-ink-750 px-4 py-2.5 font-display text-[14px] font-semibold text-bone-100 outline-none"
        />
      </div>

      {mode === "create" ? (
        <div className="mt-5">
          <FieldLabel>Tenure — active ritual time</FieldLabel>
          <div className="flex flex-wrap gap-2">
            {TENURE_PRESETS.map((p, i) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setTenure(i)}
                className={`press rounded-full px-3.5 py-1.5 text-[12px] font-bold ${
                  tenure === i ? "bg-bone-50 text-ink-950" : "bg-ink-750 text-fog-400"
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setTenure(4)}
              className={`press rounded-full px-3.5 py-1.5 text-[12px] font-bold ${
                tenure === 4 ? "bg-bone-50 text-ink-950" : "bg-ink-750 text-fog-400"
              }`}
            >
              Custom
            </button>
          </div>
          {tenure === 4 ? (
            <div className="mt-2.5 flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={3650}
                value={customDays}
                onChange={(e) => setCustomDays(Math.max(1, Number(e.target.value) || 1))}
                className="w-24 rounded-lg bg-ink-750 px-3 py-2 text-center font-display text-[13px] font-bold text-bone-100 outline-none"
              />
              <span className="text-[12px] font-semibold text-fog-500">active days</span>
            </div>
          ) : null}
          <p className="mt-2 text-[10.5px] font-medium leading-relaxed text-fog-600">
            Vacation pauses the clock — the duration never changes, only the
            projected completion date moves.
          </p>
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-ink-750/60 px-3.5 py-3 text-[11px] font-medium leading-relaxed text-fog-500">
          Tenure is fixed for this ritual period. To change the duration,
          end or complete this ritual and renew with new terms.
        </p>
      )}

      <div className="mt-5">
        <FieldLabel>During vacation</FieldLabel>
        <Seg
          value={vacBehavior}
          onChange={(v) => setVacBehavior(v)}
          options={[
            { value: "pause", label: "Pause this ritual" },
            { value: "continue", label: "Keep it running" },
          ]}
        />
      </div>

      <button
        type="button"
        onClick={() => void submit(false)}
        disabled={!name.trim() || busy || (scheduleType === "days" && days.length === 0)}
        className="press mt-6 h-12 w-full rounded-xl bg-ember-500 text-[15px] font-extrabold text-ink-950 disabled:opacity-40"
      >
        {busy
          ? "Saving…"
          : mode === "create"
            ? "Start ritual"
            : "Save — new version from today"}
      </button>
    </Sheet>
  );
}
