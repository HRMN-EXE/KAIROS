const pad = (n: number) => String(n).padStart(2, "0");

export function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function fromISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

/** Monday-first week containing the given day. */
export function weekOf(iso: string): string[] {
  const d = fromISO(iso);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d);
    x.setDate(d.getDate() + i);
    return toISO(x);
  });
}

export function weekdayLetter(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", { weekday: "narrow" });
}

export function weekdayShort(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", { weekday: "short" });
}

export function weekdayLong(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", { weekday: "long" });
}

export function monthShort(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", { month: "short" });
}

export function fmtFull(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function fmtShort(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function dayNum(iso: string): number {
  return fromISO(iso).getDate();
}

export function yearOf(iso: string): number {
  return fromISO(iso).getFullYear();
}

export function fmtTime(t: string | null): string | null {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hh} ${ap}` : `${hh}:${pad(m)} ${ap}`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 22) return "Good evening";
  return "Winding down";
}

/** Local "YYYY-MM-DDTHH:mm" for a Date — keeps day keys stable. */
export function localDT(d: Date): string {
  return `${toISO(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "HH:mm" 12-hour clock from a local "YYYY-MM-DDTHH:mm" datetime string. */
export function fmtClock(dt: string): string {
  const [h, m] = dt.slice(11, 16).split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${ap}`;
}

/** "Sunday, 20 September 2026" */
export function fmtLong(iso: string): string {
  const d = fromISO(iso);
  return `${weekdayLong(iso)}, ${d.getDate()} ${d.toLocaleDateString("en-US", { month: "long" })} ${d.getFullYear()}`;
}

/** "September 2026" */
export function monthLabel(iso: string): string {
  return fromISO(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function addMonths(iso: string, n: number): string {
  const d = fromISO(iso);
  d.setDate(1);
  d.setMonth(d.getMonth() + n);
  return toISO(d);
}

export function sameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** Monday-first grid of the month containing `iso`; nulls pad foreign weeks. */
export function monthGrid(iso: string): (string | null)[][] {
  const first = fromISO(iso);
  first.setDate(1);
  const lead = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(1 - lead);
  const weeks: (string | null)[][] = [];
  const cur = new Date(start);
  for (let w = 0; w < 6; w++) {
    const row: (string | null)[] = [];
    for (let i = 0; i < 7; i++) {
      row.push(cur.getMonth() === first.getMonth() ? toISO(cur) : null);
      cur.setDate(cur.getDate() + 1);
    }
    if (row.some((x) => x !== null)) weeks.push(row);
  }
  return weeks;
}

export function relativeDayLabel(iso: string): string {
  const today = todayISO();
  if (iso === today) return "today";
  if (iso === addDays(today, 1)) return "tomorrow";
  if (iso === addDays(today, -1)) return "yesterday";
  return fmtShort(iso);
}
