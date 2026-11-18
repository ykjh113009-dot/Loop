import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Landmark, HeartHandshake, IdCard, MapPin, Medal } from "lucide-react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { EVENT_FIELDS, type EventSummary } from "@/lib/queries";
import { houseColor } from "@/lib/house";
import { categoryOf } from "@/lib/challenges";
import { DashCard } from "@/components/dashboard/card";
import { EventCard } from "@/components/event-card";
import { PageSkeleton } from "@/components/skeleton";
import { PageBanner } from "@/components/ui/page-banner";
import { SectionTabs } from "@/components/ui/section-tabs";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "School Life" };

async function SchoolLife() {
  const me = await requireMe();
  const { t } = await getT();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [{ data: events }, { data: challenges }, { data: houses }, { data: myHouse }] = await Promise.all([
    supabase.from("events").select(EVENT_FIELDS).eq("status", "approved").gt("starts_at", now).order("starts_at").limit(3),
    supabase.from("challenges").select("id, title, category, points, ends_at").eq("status", "approved").lte("starts_at", now).gt("ends_at", now).order("ends_at").limit(2),
    supabase.rpc("house_leaderboard", { p_period: "week" }),
    supabase.rpc("my_house"),
  ]);
  const top = Math.max(1, ...(houses ?? []).map((h) => Number(h.points)));
  const tiles = [
    { href: "/council", label: "Student Council", text: "Proposals, elections and ideas", icon: Landmark },
    { href: "/volunteering", label: "Volunteering", text: "Give time, get a certificate", icon: HeartHandshake },
    { href: "/passport", label: "Loop Passport", text: "Everything you took part in", icon: IdCard },
    { href: "/leaderboard", label: "Leaderboards", text: "Students, houses and grades", icon: Medal },
    { href: "/campus", label: "Campus Map & Directory", text: "Find your way around", icon: MapPin },
  ];

  return (
    <div className="space-y-5" data-category-page="school-life">
      <PageBanner title={t("School Life")} subtitle={t("Get involved. Make an impact.")} note={t("Events, challenges and more await you!")} scene="campus" />
      <SectionTabs label={t("School Life")} current="" items={[
        { href: "/events", label: t("Upcoming Events"), icon: "calendar" }, { href: "/challenges", label: t("Challenges"), icon: "trophy" },
        { href: "/houses", label: t("Houses"), icon: "houses" }, { href: "/council", label: t("Student Council"), icon: "council" },
        { href: "/volunteering", label: t("Volunteering"), icon: "heart" }, { href: "/leaderboard", label: t("Leaderboards"), icon: "medal" },
      ]} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <DashCard title={t("Upcoming events")} href="/events" linkLabel={t("See all")}>
            <p className="mb-3 text-xs text-ink-2">{t("Assemblies, trips, shows and club meetings. Say you're going and we'll remind you.")}</p>
            {(events ?? []).length === 0 ? (
              <EmptyState compact scene="campus" title={t("No upcoming events yet")} action={{ href: "/events", label: t("Explore the calendar") }} secondary={{ href: "/events/new", label: t("Suggest an event") }}>
                {t("When your school or a club plans something, it shows up here.")}
              </EmptyState>
            ) : <div className="space-y-2" data-card="events">{(events as unknown as EventSummary[]).map((e) => <EventCard key={e.id} event={e} />)}</div>}
          </DashCard>

          <DashCard title={t("This week's challenges")} href="/challenges" linkLabel={t("See all")}>
            <p className="mb-3 text-xs text-ink-2">{t("Academic, creative, sports and fun challenges. Complete them to earn points.")}</p>
            {(challenges ?? []).length === 0 ? (
              <EmptyState compact scene="community" title={t("No challenges are running right now")} action={{ href: "/challenges", label: t("Browse challenges") }} secondary={{ href: "/challenges/new", label: t("Suggest a challenge") }}>
                {t("New ones start often. Have an idea? Suggest it.")}
              </EmptyState>
            ) : (
              <ul className="space-y-2" data-card="challenges">
                {(challenges ?? []).map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-xl bg-brand-50/70 p-3">
                    <span className="text-2xl" aria-hidden="true">{categoryOf(c.category).emoji}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-semibold">{c.title}</span><span className="text-xs text-ink-2">{t(categoryOf(c.category).label)}{c.points ? ` · +${c.points} ${t("points")}` : ""}</span></span>
                    <Link href={`/challenges/${c.id}`} className="btn-primary inline-flex items-center gap-1.5 px-3 py-1.5 text-sm">{t("Join Challenge")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" /></Link>
                  </li>
                ))}
              </ul>
            )}
          </DashCard>
        </div>

        <div className="space-y-5">
          <DashCard title={t("House points this week")} href="/houses" linkLabel={t("See all")}>
            {(houses ?? []).length === 0 ? (
              <EmptyState compact scene="campus" title={t("Houses are not set up yet")} action={me.isAdmin ? { href: "/admin/houses", label: t("Set up houses") } : undefined}>
                {t("Houses compete together all year. Your school will announce them soon.")}
              </EmptyState>
            ) : (
              <ol className="space-y-2.5" data-card="houses">
                {(houses ?? []).map((h) => (
                  <li key={h.house_id} className={`rounded-xl px-2 py-1.5 ${h.house_id === myHouse ? "bg-brand-50" : ""}`}>
                    <div className="flex items-center gap-2.5"><span className="flex size-9 items-center justify-center rounded-full text-xl" style={{ background: houseColor(h.color) + "26" }}>{h.emoji}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold">{h.name}</span><span className="text-sm font-semibold tabular-nums">{Number(h.points).toLocaleString("en")}</span></div>
                    <div className="mt-1.5 h-1.5 rounded-full bg-black/5"><div className="h-1.5 rounded-full" style={{ width: `${Math.max(4, (Number(h.points) / top) * 100)}%`, background: houseColor(h.color) }} /></div>
                  </li>
                ))}
              </ol>
            )}
          </DashCard>
          <DashCard title={t("More in School Life")}>
            <ul className="grid gap-2">
              {tiles.map((x) => (
                <li key={x.href}><Link href={x.href} className="flex items-center gap-3 rounded-xl border border-brand-700/10 bg-white px-3 py-2.5 hover:border-brand-700/25">
                  <x.icon className="size-5 shrink-0 text-brand-700" strokeWidth={1.8} aria-hidden="true" /><span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{t(x.label)}</span><span className="block truncate text-xs text-ink-2">{t(x.text)}</span></span></Link></li>
              ))}
            </ul>
          </DashCard>
        </div>
      </div>
    </div>
  );
}

export default function SchoolLifePage() {
  return <Suspense fallback={<PageSkeleton />}><SchoolLife /></Suspense>;
}
