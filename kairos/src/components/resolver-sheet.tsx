"use client";

import { fmtShort } from "@/lib/dates";
import type { TaskDTO } from "@/lib/types";
import { FlameIcon } from "./icons";
import { Sheet } from "./ui";

/**
 * End-of-day resolution prompt: every past, incomplete Must/Should task must be
 * explicitly carried forward (max 2 carries) or marked missed. Never automatic.
 */
export function ResolverSheet({
  items,
  autoMissed,
  onCarry,
  onMiss,
  onClose,
}: {
  items: TaskDTO[];
  autoMissed: TaskDTO[];
  onCarry: (t: TaskDTO) => void;
  onMiss: (t: TaskDTO) => void;
  onClose: () => void;
}) {
  return (
    <Sheet open title="Loose ends" onClose={onClose}>
      <p className="text-[12.5px] font-medium leading-relaxed text-fog-400">
        Some Must / Should tasks didn&rsquo;t close. Decide each one — your day
        streak depends on it.
      </p>

      {autoMissed.length > 0 ? (
        <div className="mt-4 rounded-xl border border-coral-400/20 bg-coral-400/10 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-coral-400">
            <FlameIcon width={12} height={12} />
            Auto-marked missed
          </p>
          <p className="mt-1.5 text-[12px] font-medium leading-relaxed text-fog-400">
            {autoMissed.map((t) => `“${t.title}”`).join(", ")} — carry limit
            (2×) was already used, so these break the streak.
          </p>
        </div>
      ) : null}

      <div className="mt-4 space-y-3">
        {items.map((t) => (
          <div key={t.id} className="rounded-xl border border-white/5 bg-ink-800 p-3.5">
            <p className="text-[13.5px] font-bold text-bone-100">{t.title}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-fog-500">
              From {fmtShort(t.day)} · carried {t.carries}/2
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onCarry(t)}
                className="press h-10 flex-1 rounded-lg bg-ember-500 text-[12.5px] font-extrabold text-ink-950"
              >
                Carry to today
              </button>
              <button
                type="button"
                onClick={() => onMiss(t)}
                className="press h-10 flex-1 rounded-lg border border-coral-400/25 bg-coral-400/10 text-[12.5px] font-extrabold text-coral-400"
              >
                Mark missed
              </button>
            </div>
          </div>
        ))}
      </div>

      {items.length > 0 ? (
        <button
          type="button"
          onClick={onClose}
          className="press mt-4 h-11 w-full rounded-xl border border-white/8 bg-ink-800 text-[13px] font-bold text-fog-400"
        >
          Decide later
        </button>
      ) : (
        <p className="mt-5 text-center text-[12.5px] font-semibold text-fog-500">
          All settled.
        </p>
      )}
    </Sheet>
  );
}
