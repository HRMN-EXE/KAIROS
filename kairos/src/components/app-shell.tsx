"use client";

import { useCallback, useEffect, useState } from "react";
import { todayISO } from "@/lib/dates";
import {
  ensureOpenedOn,
  loadDB,
  setProfileName,
  type LocalDB,
} from "@/lib/localdb";
import { localRitualSync } from "@/lib/local-rituals";
import type { AppData } from "@/lib/types";
import { FlameIcon } from "./icons";
import PlannerApp from "./planner-app";

/** Assemble the AppData snapshot from the on-device DB. */
function buildAppData(db: LocalDB): AppData {
  const today = todayISO();
  const sync = localRitualSync();
  return {
    tasks: sync.tasks,
    rituals: sync.rituals,
    tags: db.tags,
    habits: db.habits,
    logs: db.logs,
    sessions: db.sessions,
    intent: db.intents.find((i) => i.day === today) ?? null,
    streak: {
      state: db.streakState,
      records: db.records,
      vacationDays: db.vacations,
      settings: db.settings,
    },
  };
}

export default function AppShell() {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState<AppData | null>(null);
  const [name, setName] = useState("");
  const [openedOn, setOpenedOn] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    // Register the service worker for offline use (best-effort).
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const db = loadDB();
    setOpenedOn(ensureOpenedOn());
    setName(db.profile.name);
    setData(buildAppData(db));
    setReady(true);
  }, []);

  const start = useCallback(() => {
    const clean = nameDraft.trim();
    if (!clean) return;
    setProfileName(clean);
    setName(clean);
    setStarted(true);
  }, [nameDraft]);

  if (!ready || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <FlameIcon width={34} height={34} className="text-ember-500" />
        <p className="font-display text-[13px] font-bold tracking-[0.3em] text-fog-500">
          KAIROS
        </p>
      </div>
    );
  }

  // Name onboarding gate.
  if (!name && !started) {
    return (
      <div className="relative flex h-full flex-col justify-center overflow-hidden px-7">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-56 w-[420px] -translate-x-1/2 rounded-full bg-ember-500/[0.08] blur-3xl" />
        <div className="relative">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-ember-500/12">
            <FlameIcon width={30} height={30} className="text-ember-500" />
          </span>
          <h1 className="mt-5 font-display text-[30px] font-bold leading-tight text-bone-50">
            Welcome to Kairos
          </h1>
          <p className="mt-2 text-[13.5px] font-medium leading-relaxed text-fog-400">
            Your day, your rituals, your streak — all stored on this device and
            working fully offline. First things first.
          </p>
          <p className="mt-6 text-[10.5px] font-bold uppercase tracking-[0.18em] text-fog-500">
            What should we call you?
          </p>
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") start();
            }}
            placeholder="Your name"
            className="mt-2 w-full rounded-2xl bg-ink-750 px-4 py-4 text-[16px] font-semibold text-bone-50 outline-none ring-ember-500/50 placeholder:text-fog-600 focus:ring-2"
          />
          <button
            type="button"
            onClick={start}
            disabled={!nameDraft.trim()}
            className="press mt-4 w-full rounded-2xl bg-ember-500 py-4 text-[15px] font-extrabold text-ink-950 disabled:opacity-40"
          >
            Begin
          </button>
          <p className="mt-4 text-center text-[10.5px] font-medium text-fog-600">
            Private by design — nothing leaves your phone.
          </p>
        </div>
      </div>
    );
  }

  return <PlannerApp initial={data} name={name} openedOn={openedOn} />;
}
