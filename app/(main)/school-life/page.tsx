import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronLeft, ChevronRight, Clock, MapPin, Star, Trophy, ShieldCheck, BarChart3, Users, Heart, IdCard, type LucideIcon } from "lucide-react";
import { requireMe } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { getMonthEvents, getUpcomingEvents } from "@/lib/dashboard";
import { localParts } from "@/lib/time";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "School Life" };

const TILES: { href: string; title: string; text: string; icon: LucideIcon; soon?: boolean }[] = [
  { href: "/events", title: "Calendar & Events", text: "School dates, events and registrations.", icon: CalendarDays },
  { href: "/challenges", title: "Activities & Challenges", text: "Competitions, activities and participation.", icon: Trophy },
  { href: "/houses", title: "Houses", text: "House identity, points and competitions.", icon: ShieldCheck },
  { href: "/leaderboard", title: "Leaderboards", text: "Top students, houses and grades.", icon: BarChart3 },
  { href: "/council", title: "Student Council", text: "Representatives, ideas, voting and updates.", icon: Users },
  { href: "/volunteering", title: "Volunteering", text: "Opportunities and service records.", icon: Heart },
  { href: "/passport", title: "Loop Passport", text: "Track your achievements and participation.", icon: IdCard },
  { href: "/campus", title: "Campus Map", text: "Explore the school campus.", icon: MapPin, soon: true },
];

const time = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Hebron", hour: "numeric", minute: "2-digit", hour12: true });

async function SchoolLife({ month }: { month?: string }) {
  await requireMe();
  const { t, locale } = await getT();
  const today = localParts(new Date());
  // The month shown: ?month=2026-11, or this month.
  const m = /^(\d{4})-(\d{2})$/.exec(month ?? "");
  let year = m ? Number(m[1]) : today.year;
  let mon = m ? Number(m[2]) : today.month;
  if (mon < 1 || mon > 12 || year < 2000 || year > 2100) { year = today.year; mon = today.month; }
  const prev = mon === 1 ? { y: year - 1, m: 12 } : { y: year, m: mon - 1 };
  const next = mon === 12 ? { y: year + 1, m: 1 } : { y: year, m: mon + 1 };
  const href = (p: { y: number; m: number }) => `/school-life?month=${p.y}-${String(p.m).padStart(2, "0")}`;
  const [monthEvents, upcoming] = await Promise.all([getMonthEvents(year, mon), getUpcomingEvents()]);
  const busy = new Set(monthEvents.map((e) => localParts(e.starts_at).day));
  const firstWeekday = new Date(Date.UTC(year, mon - 1, 1)).getUTCDay(); // 0 = Sunday
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array.from({ length: firstWeekday }, () => null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const lang = locale === "ar" ? "ar" : "en-GB";
  const monthName = new Intl.DateTimeFormat(lang, { timeZone: "UTC", month: "long", year: "numeric" }).format(new Date(Date.UTC(year, mon - 1, 1)));
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(lang, { timeZone: "UTC", weekday: "short" }).format(new Date(Date.UTC(2026, 10, 1 + i))));
  const isToday = (d: number) => year === today.year && mon === today.month && d === today.day;
  const shownEvents = upcoming.slice(0, 3);
  const card = "rounded-3xl border border-brand-700/10 bg-white/85 p-5 shadow-[0_1px_2px_rgba(40,60,40,0.04)]";

  return (
    <div className="space-y-5" data-category-page="school-life" data-wide>
      <section className="relative isolate overflow-hidden rounded-3xl bg-[#e8efe6] px-5 py-6 lg:px-8 lg:py-8" data-banner>
        <div className="pointer-events-none absolute -end-16 -top-24 -z-10 size-72 rounded-full bg-[#d7e6d9]" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-32 end-28 -z-10 h-56 w-[28rem] rounded-[50%] bg-[#d3dfc3]/80" aria-hidden="true" />
        <h1 className="font-heading text-[34px] leading-none font-semibold text-brand-900 lg:text-[50px]" data-banner-title>{t("School Life")}</h1>
        <p className="mt-2 max-w-xl text-[13px] text-ink-2 lg:mt-3 lg:text-lg">{t("Get involved. Make an impact. Be part of your school.")}</p>
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className={card} data-card="calendar">
          <header className="mb-3 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-2.5 text-[20px] font-semibold"><CalendarDays className="size-6 text-brand-700" strokeWidth={1.8} aria-hidden="true" />{t("Calendar")}</h2>
            <div className="flex items-center gap-2 text-[15px]">
              <span data-calendar-month>{monthName}</span>
              <Link href={href(prev)} aria-label={t("Previous month")} className="rounded-full p-1.5 hover:bg-sage-soft/60"><ChevronLeft className="size-5 rtl:rotate-180" aria-hidden="true" /></Link>
              <Link href={href(next)} aria-label={t("Next month")} className="rounded-full p-1.5 hover:bg-sage-soft/60"><ChevronRight className="size-5 rtl:rotate-180" aria-hidden="true" /></Link>
            </div>
          </header>
          <div className="grid grid-cols-7 gap-y-1 text-center text-sm" role="grid" aria-label={monthName}>
            {weekdays.map((w) => <span key={w} className="pb-2 text-xs text-ink-2" role="columnheader">{w}</span>)}
            {cells.map((d, i) => d === null ? <span key={`b${i}`} /> : (
              <span key={d} role="gridcell" className="flex justify-center py-1" data-day={d}>
                <span className={`relative flex size-9 items-center justify-center rounded-full text-[15px] ${isToday(d) ? "bg-brand-700 font-semibold text-white" : ""}`} data-today={isToday(d) ? "true" : undefined}>
                  {d}
                  {busy.has(d) && <span className={`absolute bottom-0.5 size-1.5 rounded-full ${isToday(d) ? "bg-white" : "bg-brand-700"}`} aria-label={t("Has events")} data-busy />}
                </span>
              </span>
            ))}
          </div>
        </section>

        <section className={card} data-card="events">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2.5 text-[20px] font-semibold"><Star className="size-6 text-brand-700" strokeWidth={1.8} aria-hidden="true" />{t("Upcoming Events")}</h2>
            <Link href="/events" className="text-sm font-medium hover:underline">{t("See all")} →</Link>
          </header>
          {shownEvents.length === 0 ? (
            <p className="rounded-2xl bg-sage-soft/40 px-4 py-8 text-center text-sm text-ink-2">{t("No upcoming events yet")}</p>
          ) : (
            <ul className="divide-y divide-brand-700/10">
              {shownEvents.map((e) => {
                const p = localParts(e.starts_at);
                const mshort = new Intl.DateTimeFormat(lang, { timeZone: "UTC", month: "short" }).format(new Date(Date.UTC(p.year, p.month - 1, 1))).toUpperCase();
                return (
                  <li key={e.id}>
                    <Link href={`/events/${e.id}`} className="flex items-center gap-4 py-3.5 first:pt-0 last:pb-0">
                      <span className="flex size-[60px] shrink-0 flex-col items-center justify-center rounded-2xl bg-sage-soft/60 leading-tight" aria-hidden="true">
                        <span className="text-[11px] text-ink-2">{mshort}</span>
                        <span className="text-[22px] font-semibold">{p.day}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[17px] font-semibold">{e.title}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[13px] text-ink-2">
                          <span className="inline-flex items-center gap-1.5"><Clock className="size-4" aria-hidden="true" />{time.format(new Date(e.starts_at))}{e.ends_at ? ` – ${time.format(new Date(e.ends_at))}` : ""}</span>
                          {e.location && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden="true" />{e.location}</span>}
                        </span>
                      </span>
                      <ChevronRight className="size-5 shrink-0 text-ink-2 rtl:rotate-180" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" data-school-tiles>
        {TILES.map(({ href: to, title, text, icon: Icon, soon }) => (
          <Link key={to} href={to} className="relative isolate flex min-h-[170px] flex-col overflow-hidden rounded-3xl border border-brand-700/10 bg-white/85 p-5 shadow-[0_1px_2px_rgba(40,60,40,0.04)] hover:bg-white" data-tile={title}>
            <span className="pointer-events-none absolute -end-8 -top-10 -z-10 size-32 rounded-full bg-sage-soft/60" aria-hidden="true" />
            {soon && <span className="absolute end-3 top-3 rounded-full bg-sage-soft px-2.5 py-1 text-xs font-medium text-brand-800">{t("Soon")}</span>}
            <Icon className="size-10 text-brand-800" strokeWidth={1.5} aria-hidden="true" />
            <h2 className="mt-3 text-[19px] leading-tight font-semibold">{t(title)}</h2>
            <span className="mt-auto flex items-end justify-between gap-3 pt-2">
              <span className="text-sm text-ink-2">{t(text)}</span>
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-soft/70 text-brand-900" aria-hidden="true"><ArrowRight className="size-5 rtl:rotate-180" /></span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export default function SchoolLifePage(props: PageProps<"/school-life">) {
  return <Suspense fallback={<PageSkeleton />}><Month searchParams={props.searchParams} /></Suspense>;
}

async function Month({ searchParams }: { searchParams: PageProps<"/school-life">["searchParams"] }) {
  const { month } = await searchParams;
  return <SchoolLife month={typeof month === "string" ? month : undefined} />;
}
