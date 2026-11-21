import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const key = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
export const monthParam = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

// A month grid (weeks start on Sunday). Days with events get a dot and link
// down to that day's list.
export function MonthCalendar({
  year,
  month,
  todayKey,
  eventDays,
  extra = "",
}: {
  year: number;
  month: number;
  todayKey: string;
  eventDays: Map<string, number>;
  /** Extra query text kept on the arrows, e.g. "&category=sports". */
  extra?: string;
}) {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const prev = month === 1 ? monthParam(year - 1, 12) : monthParam(year, month - 1);
  const next = month === 12 ? monthParam(year + 1, 1) : monthParam(year, month + 1);

  return (
    <div className="rounded-3xl border border-black/5 bg-white p-4 shadow-sm sm:p-5" data-month-calendar>
      <div className="mb-3 flex items-center justify-between">
        <Link href={`/events?month=${prev}${extra}`} className="flex size-11 items-center justify-center rounded-full bg-sage-soft/70 text-brand-800 hover:bg-sage-soft" aria-label="Previous month"><ChevronLeft className="size-5 rtl:rotate-180" aria-hidden="true" /></Link>
        <p className="font-heading text-2xl font-semibold text-brand-900">{MONTH_NAMES[month - 1]} {year}</p>
        <Link href={`/events?month=${next}${extra}`} className="flex size-11 items-center justify-center rounded-full bg-sage-soft/70 text-brand-800 hover:bg-sage-soft" aria-label="Next month"><ChevronRight className="size-5 rtl:rotate-180" aria-hidden="true" /></Link>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center text-sm font-medium text-ink-2">
        {WEEKDAYS.map((d) => <div key={d} className="py-1.5">{d}</div>)}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1.5 text-center">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="rounded-xl border border-black/[0.04] bg-cream/50 py-4 sm:py-5" aria-hidden="true" />;
          const k = key(year, month, day);
          const count = eventDays.get(k) ?? 0;
          const isToday = k === todayKey;
          const inner = (
            <>
              <span className={`mx-auto flex size-9 items-center justify-center rounded-full text-[17px] sm:size-10 ${isToday ? "bg-brand-700 font-bold text-white" : "text-ink"}`}>{day}</span>
              <span className={`mx-auto mt-0.5 block size-1.5 rounded-full ${count ? "bg-brand-600" : "bg-transparent"}`} />
            </>
          );
          return count ? (
            <a key={i} href={`#day-${k}`} className="rounded-xl border border-black/[0.06] bg-cream/60 py-1.5 transition-colors hover:bg-sage-soft/60">{inner}</a>
          ) : (
            <div key={i} className="rounded-xl border border-black/[0.04] bg-cream/50 py-1.5">{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
