"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";

const pad = (n: number) => String(n).padStart(2, "0");

// Time left in the competition. Ticks every second without reloading the page.
export function Countdown({ endsAt, label, endedLabel, units }: { endsAt: string; label: string; endedLabel: string; units: { d: string; h: string; m: string } }) {
  const end = new Date(endsAt).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  const left = now === null ? null : Math.max(0, end - now);
  const d = left === null ? 0 : Math.floor(left / 86400000);
  const h = left === null ? 0 : Math.floor((left % 86400000) / 3600000);
  const m = left === null ? 0 : Math.floor((left % 3600000) / 60000);
  return (
    <p className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-2" data-countdown>
      <Clock className="size-4 text-gold" aria-hidden="true" />
      <span>{label}</span>
      {left === 0
        ? <strong className="text-ink">{endedLabel}</strong>
        : <strong className="tabular-nums text-ink" suppressHydrationWarning>{left === null ? "…" : `${d}${units.d} ${pad(h)}${units.h} ${pad(m)}${units.m}`}</strong>}
    </p>
  );
}
