"use client";

import { PERFECT_RUN_TARGET } from "@/lib/types";
import { useApp } from "./app-context";
import { ChevronRightIcon, FlameIcon, ShieldIcon } from "./icons";

const KIND_STYLE: Record<
  string,
  { border: string; headline: string; glow: string }
> = {
  SAFE: {
    border: "border-mint-500/20",
    headline: "text-mint-400",
    glow: "bg-mint-500/[0.07]",
  },
  PROTECTED: {
    border: "border-lilac-400/25",
    headline: "text-lilac-400",
    glow: "bg-lilac-400/[0.07]",
  },
  AT_RISK: {
    border: "border-ember-500/30",
    headline: "text-ember-400",
    glow: "bg-ember-500/[0.09]",
  },
  FINAL_WARNING: {
    border: "border-coral-400/40",
    headline: "text-coral-400",
    glow: "bg-coral-400/[0.10]",
  },
  VACATION: {
    border: "border-sky-400/25",
    headline: "text-sky-400",
    glow: "bg-sky-400/[0.07]",
  },
  INACTIVE: {
    border: "border-white/8",
    headline: "text-fog-400",
    glow: "bg-white/[0.03]",
  },
  INACTIVE_WARNING: {
    border: "border-gold-400/30",
    headline: "text-gold-400",
    glow: "bg-gold-400/[0.08]",
  },
};

/** The streak is a primary feature: first thing under the date, impossible to miss. */
export function StreakCard() {
  const { streakState, status, openStreakSheet } = useApp();
  const s = KIND_STYLE[status.kind] ?? KIND_STYLE.INACTIVE;
  const atRisk =
    (status.kind === "AT_RISK" || status.kind === "FINAL_WARNING") &&
    status.remaining > 0;
  const runPct = Math.min(100, (streakState.perfectRun / PERFECT_RUN_TARGET) * 100);

  function scrollToStack(e: React.MouseEvent) {
    e.stopPropagation();
    document
      .getElementById("today-stack")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <button
      type="button"
      onClick={openStreakSheet}
      className={`press relative w-full overflow-hidden rounded-3xl border ${s.border} bg-ink-800 p-5 text-left`}
      aria-label="Open streak details"
    >
      <div
        className={`pointer-events-none absolute -right-10 -top-16 size-48 rounded-full ${s.glow} blur-2xl`}
      />

      <div className="relative flex items-start gap-4">
        <span
          className={`flex size-13 shrink-0 items-center justify-center rounded-2xl bg-ember-500/12 ${
            streakState.streak > 0 ? "" : "grayscale opacity-60"
          }`}
        >
          <FlameIcon
            width={26}
            height={26}
            className={streakState.streak > 0 ? "text-ember-400" : "text-fog-500"}
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-[40px] font-bold leading-none text-bone-50">
              {streakState.streak}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-fog-500">
              day streak
            </span>
          </div>
          <p className={`mt-1.5 text-[13.5px] font-bold ${s.headline}`}>
            {status.headline}
          </p>
          <p className="mt-0.5 text-[11.5px] font-medium leading-relaxed text-fog-400">
            {status.detail}
          </p>
        </div>
        <ChevronRightIcon width={16} height={16} className="mt-1 shrink-0 text-fog-600" />
      </div>

      {atRisk ? (
        <div className="relative mt-3.5">
          <span
            role="button"
            tabIndex={0}
            onClick={scrollToStack}
            onKeyDown={(e) => {
              if (e.key === "Enter") scrollToStack(e as unknown as React.MouseEvent);
            }}
            className="press inline-flex items-center gap-1.5 rounded-full bg-ember-500 px-3.5 py-1.5 text-[11.5px] font-extrabold text-ink-950"
          >
            View remaining tasks
          </span>
        </div>
      ) : null}

      {status.pendingDays > 0 ? (
        <p className="relative mt-3 text-[11px] font-bold text-lilac-400">
          {status.pendingDays} loose {status.pendingDays === 1 ? "end" : "ends"}{" "}
          from earlier days — resolve {status.pendingDays === 1 ? "it" : "them"}{" "}
          to settle your streak.
        </p>
      ) : null}

      <div className="relative mt-4 flex items-center gap-3 border-t border-white/5 pt-3.5">
        <span className="flex items-center gap-1.5">
          <ShieldIcon
            width={14}
            height={14}
            className={streakState.protections > 0 ? "text-lilac-400" : "text-fog-600"}
          />
          <span className="text-[11.5px] font-bold text-bone-300">
            {streakState.protections}{" "}
            {streakState.protections === 1 ? "protection" : "protections"}
          </span>
        </span>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-fog-500">
            next 🛡 {streakState.perfectRun}/{PERFECT_RUN_TARGET}
          </span>
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-ink-700">
            <span
              className="block h-full rounded-full bg-gradient-to-r from-lilac-400 to-ember-400 transition-all duration-500"
              style={{ width: `${runPct}%` }}
            />
          </span>
        </span>
      </div>
    </button>
  );
}
