"use client";

import { useState } from "react";
import { HABIT_COLORS, HABIT_ICONS } from "@/lib/types";
import { useApp } from "./app-context";
import { CheckIcon } from "./icons";
import { FieldLabel, Seg, Sheet } from "./ui";

export function HabitSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return <HabitSheetInner onClose={onClose} />;
}

function HabitSheetInner({ onClose }: { onClose: () => void }) {
  const { addHabit } = useApp();
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(HABIT_ICONS[0]);
  const [color, setColor] = useState("ember");
  const [target, setTarget] = useState(5);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!name.trim() || busy) return;
    setBusy(true);
    try {
      await addHabit({ name: name.trim(), icon, color, weekTarget: target });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open title="New ritual" onClose={onClose}>
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
        }}
        placeholder="Name the ritual…"
        className="w-full rounded-xl bg-ink-750 px-4 py-3.5 text-[15px] font-semibold text-bone-50 outline-none ring-ember-500/50 placeholder:text-fog-600 focus:ring-2"
      />

      <div className="mt-5">
        <FieldLabel>Mark</FieldLabel>
        <div className="grid grid-cols-6 gap-2">
          {HABIT_ICONS.map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setIcon(i)}
              className={`press flex size-11 items-center justify-center rounded-xl text-[18px] ${
                icon === i
                  ? "bg-bone-50"
                  : "bg-ink-750"
              }`}
            >
              {i}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <FieldLabel>Color</FieldLabel>
        <div className="flex gap-2.5">
          {Object.entries(HABIT_COLORS).map(([key, c]) => (
            <button
              key={key}
              type="button"
              onClick={() => setColor(key)}
              aria-label={key}
              className={`press flex size-10 items-center justify-center rounded-full ${c.dot} ${
                color === key ? "ring-2 ring-bone-50 ring-offset-2 ring-offset-ink-850" : ""
              }`}
            >
              {color === key ? (
                <CheckIcon width={15} height={15} strokeWidth={3} className="text-ink-950" />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <FieldLabel>Weekly target</FieldLabel>
        <Seg
          value={target}
          onChange={(v) => setTarget(v)}
          options={[3, 5, 7].map((n) => ({
            value: n,
            label: `${n}× / week`,
          }))}
        />
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={!name.trim() || busy}
        className="press mt-6 h-12 w-full rounded-xl bg-ember-500 text-[15px] font-extrabold text-ink-950 disabled:opacity-40"
      >
        {busy ? "Adding…" : "Start the ritual"}
      </button>
    </Sheet>
  );
}
