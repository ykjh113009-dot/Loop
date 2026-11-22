import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { EVENT_FIELDS, type EventSummary } from "@/lib/queries";
import { EVENT_CATEGORIES } from "@/lib/events";
import { formatDate, fromLocalInput, localDayKey, localParts, weekStart } from "@/lib/time";
import { EventRow } from "@/components/events/event-row";
import { ImageBanner } from "@/components/ui/image-banner";
import { ArrowRight, CalendarDays, Plus } from "lucide-react";
import { MonthCalendar, monthParam } from "@/components/month-calendar";
import { Empty } from "@/components/empty";
import { PageSkeleton } from "@/components/skeleton";
import { Glyph } from "@/components/glyph";

export const metadata = { title: "Events" };

const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const startOf = (key: string) => fromLocalInput(`${key}T00:00`)!;

async function Events({ searchParams }: { searchParams: PageProps<"/events">["searchParams"] }) {
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const now = new Date();
  const today = localParts(now);
  const todayKey = localDayKey(now);

  const sp = await searchParams;
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const view = ["month", "week", "day", "list"].includes(one("view")) ? one("view") : "month";
  const category = EVENT_CATEGORIES.some((c) => c.id === one("category")) ? one("category") : "";
  const q = one("q").replace(/[,()%*]/g, " ").trim().slice(0, 60);
  const mine = one("mine") === "1";
  const match = /^(\d{4})-(\d{2})$/.exec(one("month"));
  const year = match ? Number(match[1]) : today.year;
  const month = match && Number(match[2]) >= 1 && Number(match[2]) <= 12 ? Number(match[2]) : today.month;
  const dateKey = /^\d{4}-\d{2}-\d{2}$/.test(one("date")) ? one("date") : todayKey;

  // The time window for this view.
  let from: Date;
  let to: Date | null;
  let weekFirst = "";
  if (view === "month") {
    from = startOf(`${monthParam(year, month)}-01`);
    to = startOf(`${month === 12 ? monthParam(year + 1, 1) : monthParam(year, month + 1)}-01`);
  } else if (view === "week") {
    weekFirst = localDayKey(weekStart(startOf(dateKey)));
    from = startOf(weekFirst);
    to = startOf(addDays(weekFirst, 7));
  } else if (view === "day") {
    from = startOf(dateKey);
    to = startOf(addDays(dateKey, 1));
  } else {
    from = now;
    to = null;
  }

  const { data: myRsvps } = await supabase.from("event_rsvps").select("event_id, status").eq("profile_id", me.id);
  const goingTo = new Set((myRsvps ?? []).map((r) => r.event_id));
  const rsvpOf = new Map((myRsvps ?? []).map((r) => [r.event_id, r.status as "going" | "waitlist"]));
  const canRsvp = me.isStudent && !me.isSuspended;

  let query = supabase.from("events").select(`${EVENT_FIELDS}, description`).in("status", ["approved", "cancelled", "pending"]).gte("starts_at", from.toISOString()).order("starts_at");
  if (to) query = query.lt("starts_at", to.toISOString());
  if (category) query = query.eq("category", category);
  if (q) query = query.or(`title.ilike.%${q}%,location.ilike.%${q}%,description.ilike.%${q}%`);
  if (mine) query = goingTo.size ? query.in("id", [...goingTo]) : query.in("id", ["00000000-0000-0000-0000-000000000000"]);
  const { data } = await query.limit(120);
  const events = (data ?? []) as EventSummary[];

  const byDay = new Map<string, EventSummary[]>();
  for (const e of events) {
    const k = localDayKey(e.starts_at);
    byDay.set(k, [...(byDay.get(k) ?? []), e]);
  }
  const eventDays = new Map([...byDay].map(([k, list]) => [k, list.filter((e) => e.status === "approved").length]));

  const base = { view, ...(category ? { category } : {}), ...(q ? { q } : {}), ...(mine ? { mine: "1" } : {}) };
  const link = (o: Record<string, string | null>) => {
    const params = new URLSearchParams({ ...base, ...(view === "month" ? { month: monthParam(year, month) } : view !== "list" ? { date: dateKey } : {}) });
    for (const [k, v] of Object.entries(o)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    return `/events?${params}`;
  };
  const extra = `&view=month${category ? `&category=${category}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}${mine ? "&mine=1" : ""}`;
  const views = [["month", t("Month")], ["week", t("Week")], ["day", t("Day")], ["list", t("Upcoming")]] as const;

  const dayList = (keys: string[], showEmpty: boolean) =>
    keys.map((day) => {
      const list = byDay.get(day) ?? [];
      if (!showEmpty && list.length === 0) return null;
      return (
        <section key={day} id={`day-${day}`} className="scroll-mt-16">
          <h2 className="section-title">{day === todayKey ? `${t("Today")} · ` : ""}{formatDate(startOf(day))}</h2>
          {list.length === 0 ? <p className="card p-3 text-sm text-black/45">{t("Nothing planned.")}</p> : <div className="space-y-2">{list.map((e) => <EventRow key={e.id} event={e} rsvp={rsvpOf.get(e.id) ?? null} canRsvp={canRsvp} locale={locale} />)}</div>}
        </section>
      );
    });

  return (
    <div className="mx-auto max-w-4xl space-y-5" data-events-page data-wide>
      <ImageBanner name={view === "list" ? "events" : "calendar"} title={view === "list" ? "Events" : "Calendar"} subtitle={view === "list" ? "Be part of more." : "Never miss a thing."} />
      {me.isStudent && !me.isSuspended && (
        <div className="flex justify-end"><Link href="/events/new" className="btn-primary rounded-full px-5 py-2.5"><Plus className="size-4" aria-hidden="true" />{t("New event")}</Link></div>
      )}

      <div className="flex gap-1 rounded-2xl bg-black/5 p-1" role="tablist">
        {views.map(([id, label]) => (
          <Link key={id} role="tab" aria-selected={view === id} href={link({ view: id })} className={`flex-1 rounded-lg py-1.5 text-center text-sm font-medium ${view === id ? "bg-brand-700 text-white shadow-sm" : "text-black/55 hover:bg-sage-soft/60"}`}>{label}</Link>
        ))}
      </div>

      <form action="/events" className="flex gap-2">
        <input type="hidden" name="view" value={view} />
        {category && <input type="hidden" name="category" value={category} />}
        {mine && <input type="hidden" name="mine" value="1" />}
        <input name="q" defaultValue={q} className="input" placeholder={t("Search events")} aria-label={t("Search events")} />
        <button className="btn-secondary shrink-0 px-3">{t("Search")}</button>
      </form>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <Link href={link({ category: null })} className={`chip whitespace-nowrap ${!category ? "bg-brand-700 text-white" : ""}`}>{t("All")}</Link>
        {EVENT_CATEGORIES.map((c) => (
          <Link key={c.id} href={link({ category: c.id })} className={`chip whitespace-nowrap ${category === c.id ? "bg-brand-700 text-white" : ""}`}><Glyph e={c.emoji} /> {t(c.label)}</Link>
        ))}
        <Link href={link({ mine: mine ? null : "1" })} className={`chip whitespace-nowrap ${mine ? "bg-brand-700 text-white" : ""}`}><Glyph e="✓" /> {t("I'm going")}</Link>
      </div>

      {view === "month" && <MonthCalendar year={year} month={month} todayKey={todayKey} eventDays={eventDays} extra={extra} />}
      {(view === "week" || view === "day") && (
        <div className="flex items-center justify-between">
          <Link href={link({ date: addDays(view === "week" ? weekFirst : dateKey, view === "week" ? -7 : -1) })} className="btn-ghost px-3 py-1.5" aria-label={t("Previous")}>‹</Link>
          <p className="font-semibold">{view === "week" ? `${formatDate(startOf(weekFirst))} – ${formatDate(startOf(addDays(weekFirst, 6)))}` : formatDate(startOf(dateKey))}</p>
          <Link href={link({ date: addDays(view === "week" ? weekFirst : dateKey, view === "week" ? 7 : 1) })} className="btn-ghost px-3 py-1.5" aria-label={t("Next")}>›</Link>
        </div>
      )}

      <div className="flex items-center justify-between gap-3" data-upcoming-header>
        <h2 className="flex items-center gap-2.5 font-heading text-2xl font-semibold text-brand-900"><CalendarDays className="size-6 text-brand-800" strokeWidth={1.7} aria-hidden="true" />{view === "list" ? t("Upcoming Events") : view === "month" ? t("Events this month") : t("Events")}</h2>
        {view !== "list" && <Link href={link({ view: "list" })} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-800 hover:underline">{t("View all")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" /></Link>}
      </div>

      {events.length === 0 && view !== "week" ? (
        <Empty emoji="📅" title={view === "list" ? t("No upcoming events") : t("No events here")}>{(q || category || mine) && t("Try clearing the search or filters.")}</Empty>
      ) : view === "week" ? (
        dayList(Array.from({ length: 7 }, (_, i) => addDays(weekFirst, i)), true)
      ) : view === "day" ? (
        dayList([dateKey], true)
      ) : (
        dayList([...byDay.keys()], false)
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
