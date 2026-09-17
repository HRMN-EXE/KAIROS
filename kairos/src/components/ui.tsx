import { useId, type ReactNode } from "react";
import { XIcon } from "./icons";

export function Ring({
  value,
  size = 64,
  stroke = 5,
  children,
}: {
  value: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const raw = useId();
  const id = `grad-${raw.replace(/[^a-zA-Z0-9]/g, "")}`;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c * (1 - Math.min(1, Math.max(0, value)));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id={id} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffb238" />
            <stop offset="100%" stopColor="#ff6a2b" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={off}
          className="ring-anim"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

export function SectionLabel({
  children,
  right,
}: {
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-fog-500">
        {children}
      </h2>
      {right}
    </div>
  );
}

export function Seg<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-xl bg-ink-750 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-bold transition-colors ${
            value === o.value
              ? "bg-bone-50 text-ink-950"
              : "text-fog-500 active:text-bone-300"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40">
      <div
        className="absolute inset-0 animate-fade-in bg-black/65"
        onClick={onClose}
      />
      <div className="no-scrollbar absolute inset-x-0 bottom-0 max-h-[90%] animate-sheet-up overflow-y-auto rounded-t-[28px] border-t border-white/10 bg-ink-850">
        <div className="mx-auto mt-3 h-1 w-9 rounded-full bg-white/15" />
        <div className="flex items-center justify-between px-5 pb-1 pt-4">
          <h3 className="font-display text-[18px] font-bold text-bone-50">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="press flex size-8 items-center justify-center rounded-full bg-white/5 text-fog-400"
            aria-label="Close"
          >
            <XIcon width={15} height={15} />
          </button>
        </div>
        <div className="px-5 pb-[max(22px,env(safe-area-inset-bottom))] pt-2">
          {children}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  sub,
}: {
  title: string;
  sub: string;
}) {
  return (
    <div className="animate-fade-in rounded-2xl border border-dashed border-white/10 bg-ink-800/40 px-6 py-9 text-center">
      <p className="font-display text-[16px] font-bold text-bone-300">
        {title}
      </p>
      <p className="mt-1 text-[12.5px] font-medium text-fog-500">{sub}</p>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.16em] text-fog-500">
      {children}
    </p>
  );
}
