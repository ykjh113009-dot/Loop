import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EVENT_FIELDS, type EventSummary } from "@/lib/queries";
import { formatDate, fromLocalInput, localDayKey, localParts } from "@/lib/time";
import { EventCard } from "@/components/event-card";
import { MonthCalendar, monthParam } from "@/components/month-calendar";
import { Empty } from "@/components/empty";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Events" };

async function Events({ searchParams }: { searchParams: PageProps<"/events">["searchParams"] }) {
  const me = await requireMe();
  const supabase = await createClient();
  const now = new Date();
  const today = localParts(now);

  const { month: monthRaw } = await searchParams;
  const match = typeof monthRaw === "string" ? /^(\d{4})-(\d{2})$/.exec(monthRaw) : null;
  const year = match ? Number(match[1]) : today.year;
  const month = match && Number(match[2]) >= 1 && Number(match[2]) <= 12 ? Number(match[2]) : today.month;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const from = fromLocalInput(`${monthParam(year, month)}-01T00:00`)!;
  const to = fromLocalInput(`${monthParam(nextYear, nextMonth)}-01T00:00`)!;

  const [{ data }, { data: myRsvps }, { count: leaderOf }] = await Promise.all([
    supabase
      .from("events")
      .select(EVENT_FIELDS)
      .in("status", ["approved", "cancelled", "pending"])
      .gte("starts_at", from.toISOString())
      .lt("starts_at", to.toISOString())
      .order("starts_at"),
    supabase.from("event_rsvps").select("event_id").eq("profile_id", me.id),
    supabase.from("club_members").select("club_id", { count: "exact", head: true }).eq("profile_id", me.id).eq("role", "leader"),
  ]);
  const events = (data ?? []) as EventSummary[];
  const goingTo = new Set((myRsvps ?? []).map((r) => r.event_id));
  const canCreate = !me.isSuspended && (me.isStaff || (leaderOf ?? 0) > 0);

  // Group the month's events by day (Palestine time).
  const byDay = new Map<string, EventSummary[]>();
  for (const e of events) {
    const k = localDayKey(e.starts_at);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const eventDays = new Map([...byDay].map(([k, list]) => [k, list.filter((e) => e.status === "approved").length]));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Events"
        action={
          canCreate && (
            <Link href="/events/new" className="btn-primary px-3 py-2">
              <Icon name="plus" className="size-4" /> New event
            </Link>
          )
        }
      />
      <MonthCalendar year={year} month={month} todayKey={localDayKey(now)} eventDays={eventDays} />
      {events.length === 0 ? (
        <Empty emoji="📅" title="No events this month" />
      ) : (
        [...byDay].map(([day, list]) => (
          <section key={day} id={`day-${day}`} className="scroll-mt-16">
            <h2 className="section-title">{formatDate(list[0].starts_at)}</h2>
            <div className="space-y-2">
              {list.map((e) => <EventCard key={e.id} event={e} going={goingTo.has(e.id)} />)}
            </div>
          </section>
        ))
      )}
    </div>
  );
}

export default function EventsPage(props: PageProps<"/events">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Events searchParams={props.searchParams} />
    </Suspense>
  );
}
