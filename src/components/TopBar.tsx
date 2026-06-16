import Link from "next/link";
import { GraduationCap, Search } from "lucide-react";
import ThemeToggle from "./ThemeToggle";

export default function TopBar() {
  return (
    <header className="glass sticky top-0 z-30 flex items-center gap-4 border-b px-6 py-3.5">
      <Link
        href="/library"
        className="flex items-center gap-2.5 font-display text-base font-bold"
      >
        <span className="grid h-[30px] w-[30px] flex-none place-items-center rounded-[9px] bg-gradient-to-br from-teal to-coral text-white">
          <GraduationCap size={16} strokeWidth={2.4} />
        </span>
        InteractiveLearning
      </Link>

      <div
        role="search"
        className="hidden max-w-[380px] flex-1 items-center gap-2.5 rounded-full border border-border bg-surface-2 px-4 py-2 text-sm text-text-2 md:flex"
      >
        <Search size={15} />
        Search your courses…
      </div>

      <div className="ml-auto flex items-center gap-2.5">
        <ThemeToggle />
      </div>
    </header>
  );
}

/** Re-exported for back-compat with the lesson route's hero ring. */
export function ProgressRing({
  value,
  size = 84,
  label,
  trackClass = "stroke-white/20",
  textClass = "text-white",
}: {
  value: number;
  size?: number;
  label?: string;
  trackClass?: string;
  textClass?: string;
}) {
  const r = size * 0.43;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  return (
    <div
      role="img"
      aria-label={label ?? `Progress ${value} percent`}
      className="relative flex-none"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={size * 0.095} className={trackClass} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          strokeWidth={size * 0.095} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={offset}
          className="stroke-teal transition-[stroke-dashoffset] duration-500 ease-brand"
        />
      </svg>
      <span
        className={`absolute inset-0 grid place-items-center font-display font-bold ${textClass}`}
        style={{ fontSize: size * 0.2 }}
      >
        {value}%
      </span>
    </div>
  );
}

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-[7px] overflow-hidden rounded-full bg-surface-2">
      <i className="block h-full rounded-full bg-gradient-to-r from-teal to-primary" style={{ width: `${value}%` }} />
    </div>
  );
}
