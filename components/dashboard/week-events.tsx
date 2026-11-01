import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { getUpcomingEvents, iconFor } from "@/lib/dashboard";
import { formatActivityTime } from "@/lib/time";
import { CardEmpty, DashCard, IconTile } from "@/components/dashboard/card";

// Events happening in the next 7 days.
export async function WeekEvents() {
  await requireMe();
  const events = await getUpcomingEvents();
  const today = new Date();
  const end = today.getTime() + 7 * 24 * 3600 * 1000;
  const week = events.filter((e) => new Date(e.starts_at).getTime() < end).slice(0, 4);
  return (
    <DashCard title="This Week's Events" href="/events" linkLabel="All">
      {week.length === 0 ? (
        <CardEmpty icon="calendar">No events in the next 7 days.</CardEmpty>
      ) : (
        <ul className="-mx-1.5 space-y-0.5">
          {week.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}`} className="flex items-center gap-3 rounded-xl px-1.5 py-1.5 hover:bg-brand-50">
                <IconTile name={iconFor(e.title)} className="size-9" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{e.title}</span>
                  <span className="block truncate text-[11px] text-ink-2">{formatActivityTime(e.starts_at, e.ends_at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashCard>
  );
}
