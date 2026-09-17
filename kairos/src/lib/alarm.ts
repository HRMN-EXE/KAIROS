/**
 * Client-side alarm engine persistence + side effects.
 * Fired-state is stored in localStorage so reminders/alarms never double-fire,
 * and snooze schedules survive reloads.
 */

export interface AlarmEntry {
  /** Signature of the schedule this entry belongs to ("day" + "time"). */
  sig: string;
  reminderFired: boolean;
  /** T-30min silent reminder for MUST tasks. */
  mustLeadFired?: boolean;
  /** Effective alarm time already handled (prevents re-firing). */
  lastAlarmAt: number | null;
  snoozeCount: number;
  /** Snoozed alarm time (epoch ms), if a snooze is pending. */
  nextAlarmAt: number | null;
}

export type AlarmState = Record<string, AlarmEntry>;

const KEY = "kairos-alarm-state-v1";

export function loadAlarmState(): AlarmState {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "{}") as AlarmState;
  } catch {
    return {};
  }
}

export function saveAlarmState(state: AlarmState): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

export const REMINDER_LEAD_MS = 5 * 60_000;
export const ALARM_LEAD_MS = 2 * 60_000;
export const MAX_SNOOZES = 2;
export const FIRST_SNOOZE_MIN = 10;

let audioCtx: AudioContext | null = null;

/** Looping two-tone alarm chime via Web Audio. Returns a stop function. */
export function startAlarmSound(): () => void {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return () => {};
    audioCtx = audioCtx ?? new Ctor();
    void audioCtx.resume();
    let stopped = false;

    const ring = () => {
      if (stopped || !audioCtx || audioCtx.state !== "running") return;
      const t0 = audioCtx.currentTime;
      [880, 1174.66].forEach((freq, i) => {
        if (!audioCtx) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = t0 + i * 0.18;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.3, start + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(start);
        osc.stop(start + 0.38);
      });
    };

    ring();
    const iv = setInterval(ring, 950);
    return () => {
      stopped = true;
      clearInterval(iv);
    };
  } catch {
    return () => {};
  }
}

export function vibrate(pattern: number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

export function stopVibrate(): void {
  try {
    navigator.vibrate?.(0);
  } catch {
    /* ignore */
  }
}

/** Silent system notification for the T-5min reminder (no sound). */
export function notifySystem(title: string, body: string, tag: string): void {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      new Notification(title, { body, tag, silent: true });
    }
  } catch {
    /* ignore */
  }
}

export function requestNotificationPermission(): void {
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }
  } catch {
    /* ignore */
  }
}
