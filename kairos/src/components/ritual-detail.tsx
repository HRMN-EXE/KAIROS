"use client";

import { useState } from "react";
import { addDays, todayISO, weekdayLetter } from "@/lib/dates";
import {
  fmtShortISO,
  scheduleLabel,
  spanLabel,
  tenureLabel,
  type RitualDTO,
} from "@/lib/ritual-meta";
import { PRIORITY_META } from "@/lib/types";
import { useApp } from "./app-context";
import { CheckIcon, PencilIcon } from "./icons";
import { Sheet } from "./ui";

const END_REASONS = [
  "No longer relevant",
  "Major schedule change",
  "Major life change",
  "Other",
];

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-mint-500/15 text-mint-400",
  COMPLETE: "bg-sky-400/15 text-sky-400",
  EARLY_EXIT: "bg-coral-400/15 text-coral-400",
  ARCHIVED: "bg-white/8 text-fog-400",
};

export function RitualDetailSheet({
  ritual,
  onClose,
}: {
  ritual: RitualDTO | null;
  onClose: () => void;
}) {
  if (!ritual) return null;
  return <RitualDetailInner key={ritual.commitment.id} ritual={ritual} onClose={onClose} />;
}

function RitualDetailInner({
  ritual,
  onClose,
}: {
  ritual: RitualDTO;
  onClose: () => void;
}) {
  const {
    ritualAction,
    deleteRitual,
    openRitualEdit,
    vacationDays,
    streakState,
    toast,
  } = useApp();
  const c = ritual.commitment;
  const today = todayISO();

  const [ending, setEnding] = useState(false);
  const [reason, setReason] = useState(END_REASONS[0]);
  const [renewing, setRenewing] = useState(false);
  const [renewValue, setRenewValue] = useState(6);
  const [deleting, setDeleting] = useState(false);
  const [busy, setBusy] = useState(false);

  const isVacToday =
    vacationDays.includes(today) ||
    (streakState.vacationOpenStart !== null &&
      today >= streakState.vacationOpenStart);
  const pausedNow = isVacToday && c.vacationBehavior === "pause" && c.status === "ACTIVE";

  const pct = Math.min(100, (c.activeDays / Math.max(1, c.requiredDays)) * 100);
  const p = PRIORITY_META[ritual.schedule.priority] ?? PRIORITY_META[2];

  async function doEnd() {
    setBusy(true);
    try {
      await ritualAction(ritual.id, "end-early", { reason });
      toast("Ritual ended — history preserved");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function doRenew() {
    setBusy(true);
    try {
      await ritualAction(ritual.id, "renew", {
        tenureValue: renewValue,
        tenureUnit: "MONTH",
      });
      toast("New ritual period started");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function doArchive() {
    setBusy(true);
    try {
      await ritualAction(ritual.id, "archive", {});
      toast("Archived — history preserved");
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    setBusy(true);
    try {
      await deleteRitual(ritual.id);
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open title={ritual.name} onClose={onClose}>
      {/* Hero */}
      <div className="flex items-center gap-3.5">
        <span className="flex size-13 items-center justify-center rounded-2xl bg-ember-500/10 text-[22px]">
          {ritual.icon}
        </span>
        <div className="min-w-0 flex-1">
          <span
            className={`inline-block rounded-md px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider ${
              STATUS_BADGE[c.status] ?? STATUS_BADGE.ARCHIVED
            }`}
          >
            {c.status === "EARLY_EXIT" ? "Early exit" : c.status.toLowerCase()}
          </span>
          <p className="mt-1 text-[12.5px] font-bold text-bone-300">
            {scheduleLabel(ritual.schedule.type, ritual.schedule.config)} ·{" "}
            <span className={p.text}>{p.label.toUpperCase()}</span> ·{" "}
            <span className="capitalize">{ritual.category}</span>
          </p>
        </div>
      </div>

      {/* Tenure clock */}
      <div className="mt-4 rounded-2xl border border-white/5 bg-ink-800 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-ember-400">
            {tenureLabel(c.tenureValue, c.tenureUnit)}
          </p>
          <p className="font-display text-[12px] font-bold text-bone-300">
            {spanLabel(c.activeDays)} / {spanLabel(c.requiredDays)}
          </p>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-ember-500 to-ember-300 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11.5px] font-semibold">
          <span className="text-fog-500">
            Started{" "}
            <span className="text-bone-300">{fmtShortISO(c.startDate)}</span>
          </span>
          <span className="text-fog-500">
            Active <span className="text-bone-300">{spanLabel(c.activeDays)}</span>
          </span>
          <span className="text-fog-500">
            Paused{" "}
            <span className={c.pausedDays > 0 ? "text-sky-400" : "text-bone-300"}>
              {c.pausedDays} day{c.pausedDays === 1 ? "" : "s"}
            </span>
          </span>
          <span className="text-fog-500">
            Remaining{" "}
            <span className="text-bone-300">{spanLabel(c.remainingDays)}</span>
          </span>
        </div>
        <p className="mt-2.5 border-t border-white/5 pt-2.5 text-[11px] font-semibold text-fog-500">
          {c.complete ? (
            <>
              <span className="text-mint-400">✓ Tenure complete</span> — finished{" "}
              {c.closedAt ? fmtShortISO(c.closedAt) : "today"}. The duration was
              honored in full.
            </>
          ) : (
            <>
              Projected completion:{" "}
              <span className="text-bone-300">
                {c.projectedCompletion ? fmtShortISO(c.projectedCompletion) : "—"}
              </span>{" "}
              · derived from active time{c.pausedDays > 0 ? " + pauses" : ""}, never fixed.
            </>
          )}
        </p>
        {pausedNow ? (
          <p className="mt-2 rounded-lg bg-sky-400/10 px-3 py-2 text-[11.5px] font-bold text-sky-400">
            🌴 Ritual paused — vacation is not consuming your tenure.
          </p>
        ) : null}
      </div>

      {/* Current cycle — 7-day windows anchored to the commitment start */}
      <div className="mt-4 rounded-2xl border border-white/5 bg-ink-800 p-4">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-fog-500">
          This cycle · {ritual.week.done}/{ritual.week.target}
        </p>
        <div className="mt-2.5 flex gap-1.5">
          {ritual.week.days.map((cell) => (
            <div key={cell.day} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[8.5px] font-bold uppercase text-fog-600">
                {weekdayLetter(cell.day)}
              </span>
              <span
                className={`flex size-8 items-center justify-center rounded-full text-[10px] font-bold ${
                  cell.state === "done"
                    ? "bg-mint-500 text-ink-950"
                    : cell.state === "missed"
                      ? "bg-coral-400/20 text-coral-400"
                      : cell.state === "vacation"
                        ? "bg-sky-400/15 text-sky-400"
                        : cell.state === "today"
                          ? "bg-ink-750 text-bone-100 ring-1 ring-ember-400/60"
                          : "bg-ink-750 text-fog-600"
                }`}
              >
                {cell.state === "done" ? (
                  <CheckIcon width={12} height={12} strokeWidth={3.2} />
                ) : cell.state === "missed" ? (
                  "✕"
                ) : cell.state === "vacation" ? (
                  "🌴"
                ) : (
                  "○"
                )}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] font-medium text-fog-600">
          Consistency, not a streak — the KAIROS daily streak is the only streak.
        </p>
      </div>

      {/* Schedule versioning */}
      <div className="mt-4 rounded-2xl border border-white/5 bg-ink-800 p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-fog-500">
            Schedule
          </p>
          <span className="rounded-md bg-white/5 px-2 py-0.5 text-[9.5px] font-bold text-fog-400">
            Version #{ritual.schedule.versionNo} · since{" "}
            {fmtShortISO(ritual.schedule.effectiveFrom)}
          </span>
        </div>
        <p className="mt-2 text-[13px] font-bold text-bone-100">
          {scheduleLabel(ritual.schedule.type, ritual.schedule.config)}
          {ritual.schedule.config.time
            ? ` · ${ritual.schedule.config.time}`
            : ""}
        </p>
        <p className="mt-1 text-[11px] font-medium text-fog-500">
          Vacation behavior:{" "}
          {c.vacationBehavior === "pause"
            ? "pause ritual during vacation"
            : "continue during vacation"}
          . Edits create new versions — history keeps old snapshots.
        </p>
        <button
          type="button"
          onClick={() => openRitualEdit(ritual)}
          className="press mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-ink-750 text-[12.5px] font-bold text-bone-300"
        >
          <PencilIcon width={13} height={13} />
          Edit ritual
        </button>
      </div>

      {/* Ritual history */}
      <div className="mt-4 rounded-2xl border border-white/5 bg-ink-800 p-4">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-fog-500">
          Ritual history
        </p>
        <div className="mt-2 space-y-2">
          {ritual.history.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between rounded-xl bg-ink-750/60 px-3.5 py-2.5"
            >
              <div>
                <p className="text-[12px] font-bold text-bone-100">
                  Ritual period #{h.no} · {tenureLabel(h.tenureValue, h.tenureUnit)}
                </p>
                <p className="text-[10.5px] font-semibold text-fog-500">
                  Started {fmtShortISO(h.startDate)}
                  {h.closedAt ? ` · closed ${fmtShortISO(h.closedAt)}` : ""}
                </p>
              </div>
              <span
                className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase ${
                  STATUS_BADGE[h.status] ?? STATUS_BADGE.ARCHIVED
                }`}
              >
                {h.status === "EARLY_EXIT" ? "Early exit" : h.status.toLowerCase()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Lifecycle actions */}
      <div className="mt-4 space-y-2.5 pb-2">
        {c.status === "ACTIVE" && !ending ? (
          <button
            type="button"
            onClick={() => setEnding(true)}
            className="press h-11 w-full rounded-xl border border-coral-400/25 bg-coral-400/10 text-[13px] font-bold text-coral-400"
          >
            End ritual early…
          </button>
        ) : null}

        {ending ? (
          <div className="rounded-2xl border border-coral-400/20 bg-ink-800 p-4">
            <p className="text-[13px] font-bold text-bone-100">
              End this ritual early?
            </p>
            <p className="mt-1 text-[11.5px] font-medium leading-relaxed text-fog-500">
              All history is preserved. This does not convert missed days into
              neutral days — the record stays honest.
            </p>
            <div className="mt-3 space-y-1.5">
              {END_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[12px] font-bold ${
                    reason === r
                      ? "bg-coral-400/15 text-coral-400"
                      : "bg-ink-750 text-fog-400"
                  }`}
                >
                  <span
                    className={`size-2 rounded-full ${
                      reason === r ? "bg-coral-400" : "bg-fog-600"
                    }`}
                  />
                  {r}
                </button>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setEnding(false)}
                className="press h-10 flex-1 rounded-xl border border-white/10 bg-ink-750 text-[12.5px] font-bold text-bone-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void doEnd()}
                className="press h-10 flex-1 rounded-xl bg-coral-400 text-[12.5px] font-extrabold text-ink-950 disabled:opacity-40"
              >
                End ritual
              </button>
            </div>
          </div>
        ) : null}

        {c.status === "COMPLETE" && !renewing ? (
          <div className="rounded-2xl border border-mint-500/20 bg-mint-500/10 p-4">
            <p className="text-[13px] font-bold text-mint-400">
              ✓ Tenure complete — {spanLabel(c.requiredDays)} honored.
            </p>
            <button
              type="button"
              onClick={() => setRenewing(true)}
              className="press mt-3 h-10 w-full rounded-xl bg-mint-500 text-[12.5px] font-extrabold text-ink-950"
            >
              Renew ritual…
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void doArchive()}
              className="press mt-2 h-10 w-full rounded-xl border border-white/10 bg-ink-750 text-[12.5px] font-bold text-bone-300"
            >
              Archive
            </button>
          </div>
        ) : null}

        {renewing ? (
          <div className="rounded-2xl border border-white/5 bg-ink-800 p-4">
            <p className="text-[12.5px] font-bold text-bone-100">
              Renew for how long?
            </p>
            <p className="mt-0.5 text-[11px] font-medium text-fog-500">
              Creates a new ritual period — the previous one stays intact.
            </p>
            <div className="mt-3 flex gap-2">
              {[1, 3, 6, 12].map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setRenewValue(m)}
                  className={`press flex-1 rounded-lg py-2 font-display text-[12.5px] font-bold ${
                    renewValue === m
                      ? "bg-bone-50 text-ink-950"
                      : "bg-ink-750 text-fog-400"
                  }`}
                >
                  {m}mo
                </button>
              ))}
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void doRenew()}
              className="press mt-3 h-11 w-full rounded-xl bg-ember-500 text-[13px] font-extrabold text-ink-950 disabled:opacity-40"
            >
              Start new period
            </button>
          </div>
        ) : null}

        {c.status === "EARLY_EXIT" || c.status === "ARCHIVED" ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void doArchive()}
            className="press h-11 w-full rounded-xl border border-white/10 bg-ink-750 text-[13px] font-bold text-bone-300"
          >
            Archive ritual
          </button>
        ) : null}
      </div>

      {/* Danger zone — the ONLY place a ritual can be deleted */}
      <div className="mt-2 rounded-2xl border border-coral-400/20 bg-coral-400/[0.04] p-4">
        {deleting ? (
          <>
            <p className="text-[12.5px] font-extrabold text-coral-400">
              Delete this ritual?
            </p>
            <p className="mt-1 text-[11px] font-medium leading-relaxed text-fog-500">
              This erases the ritual, its history and all of its instances —
              everywhere, permanently. There is no undo.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setDeleting(false)}
                className="press h-10 flex-1 rounded-xl border border-white/10 bg-ink-750 text-[12.5px] font-bold text-bone-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void doDelete()}
                className="press h-10 flex-1 rounded-xl bg-coral-400 text-[12.5px] font-extrabold text-ink-950 disabled:opacity-40"
              >
                Delete forever
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setDeleting(true)}
            className="press h-10 w-full rounded-xl text-[12px] font-bold text-coral-400"
          >
            Delete ritual…
          </button>
        )}
      </div>
    </Sheet>
  );
}
