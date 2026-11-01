import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { getUpcomingEvents } from "@/lib/dashboard";
import { formatActivityTime } from "@/lib/time";
import { CardEmpty, DashCard } from "@/components/dashboard/card";

// The next event on the calendar, as a bigger card.
export async function NextUp() {
  await requireMe();
  const [event] = await getUpcomingEvents();
  return (
    <DashCard title="Next Up" href="/events">
      {!event ? (
        <CardEmpty icon="calendar">No upcoming events yet.</CardEmpty>
      ) : (
        <>
          <div className="relative flex h-24 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-sage-soft via-brand-100 to-sky text-4xl lg:h-28">
            <span aria-hidden="true">{event.club?.emoji ?? "📅"}</span>
          </div>
          <p className="mt-2.5 truncate text-sm font-semibold">{event.title}</p>
          <p className="truncate text-xs text-ink-2">{formatActivityTime(event.starts_at, event.ends_at)}</p>
          {event.location && <p className="truncate text-xs text-ink-2">{event.location}</p>}
          <Link href={`/events/${event.id}`} className="mt-2.5 inline-flex rounded-lg bg-brand-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-800">
            View
          </Link>
        </>
      )}
    </DashCard>
  );
}
