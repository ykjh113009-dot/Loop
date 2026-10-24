import Link from "next/link";

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
}: {
  year: number;
  month: number;
  todayKey: string;
  eventDays: Map<string, number>;
}) {
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const prev = month === 1 ? monthParam(year - 1, 12) : monthParam(year, month - 1);
  const next = month === 12 ? monthParam(year + 1, 1) : monthParam(year, month + 1);

  return (
    <div className="card p-3">
      <div className="mb-2 flex items-center justify-between">
        <Link href={`/events?month=${prev}`} className="btn-ghost px-3 py-1.5" aria-label="Previous month">‹</Link>
        <p className="font-semibold">{MONTH_NAMES[month - 1]} {year}</p>
        <Link href={`/events?month=${next}`} className="btn-ghost px-3 py-1.5" aria-label="Next month">›</Link>
      </div>
      <div className="grid grid-cols-7 text-center text-[11px] font-medium text-black/40">
        {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-center text-sm">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const k = key(year, month, day);
          const count = eventDays.get(k) ?? 0;
          const isToday = k === todayKey;
          const inner = (
            <>
              <span className={`mx-auto flex size-8 items-center justify-center rounded-full ${isToday ? "bg-brand-700 font-bold text-white" : ""}`}>{day}</span>
              <span className={`mx-auto mt-0.5 block size-1.5 rounded-full ${count ? "bg-brand-600" : "bg-transparent"}`} />
            </>
          );
          return count ? (
            <a key={i} href={`#day-${k}`} className="rounded-lg py-1 hover:bg-black/5">{inner}</a>
          ) : (
            <div key={i} className="py-1 text-black/70">{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
