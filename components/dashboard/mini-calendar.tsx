import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { getMonthEvents } from "@/lib/dashboard";
import { localDayKey, localParts } from "@/lib/time";
import { DashCard } from "@/components/dashboard/card";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// This month at a glance. Today is filled in, days with an event have a ring.
export async function MiniCalendar() {
  await requireMe();
  const now = new Date();
  const today = localParts(now);
  const events = await getMonthEvents(today.year, today.month);
  const eventDays = new Set(events.map((e) => Number(localDayKey(e.starts_at).slice(8))));
  const first = new Date(Date.UTC(today.year, today.month - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(today.year, today.month, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  while (cells.length % 7) cells.push(null);
  const month = `${today.year}-${String(today.month).padStart(2, "0")}`;

  return (
    <DashCard title="Calendar" href={`/events?month=${month}`}>
      <p className="mb-2 text-xs font-semibold">{MONTHS[today.month - 1]} {today.year}</p>
      <div className="grid grid-cols-7 text-center text-[10px] font-medium text-ink-2">
        {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center text-xs">
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const isToday = day === today.day;
          const hasEvent = eventDays.has(day);
          return (
            <Link
              key={i}
              href={`/events?month=${month}`}
              aria-label={`${day} ${MONTHS[today.month - 1]}${hasEvent ? ", has events" : ""}${isToday ? ", today" : ""}`}
              className={`mx-auto flex size-6 items-center justify-center rounded-full tabular-nums ${
                isToday ? "bg-brand-700 font-semibold text-white" : hasEvent ? "bg-sage-soft font-semibold text-brand-900 ring-1 ring-brand-600/40" : "text-ink hover:bg-brand-50"
              }`}
            >
              {day}
            </Link>
          );
        })}
      </div>
    </DashCard>
  );
}
