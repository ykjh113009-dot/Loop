import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { getUpcomingEvents, iconFor } from "@/lib/dashboard";
import { formatActivityTime } from "@/lib/time";
import { CardEmpty, DashCard, IconTile } from "@/components/dashboard/card";

export async function UpcomingActivities() {
  await requireMe();
  const events = (await getUpcomingEvents()).slice(0, 3);
  return (
    <DashCard title="Upcoming Activities" href="/events">
      {events.length === 0 ? (
        <CardEmpty icon="calendar">Nothing is planned yet. Club leaders can add events.</CardEmpty>
      ) : (
        <ul className="-mx-1.5 space-y-0.5">
          {events.map((e) => (
            <li key={e.id}>
              <Link href={`/events/${e.id}`} className="flex items-center gap-3 rounded-xl px-1.5 py-2 hover:bg-brand-50">
                <IconTile name={iconFor(e.title)} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{e.title}</span>
                  <span className="block truncate text-xs text-ink-2">{formatActivityTime(e.starts_at, e.ends_at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashCard>
  );
}
