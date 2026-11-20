import { ClubIcon } from "@/components/club-icon";
import { signClubImages } from "@/lib/images";
import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { formatDate } from "@/lib/time";
import { leadershipLabel } from "@/lib/leadership";
import { DashCard } from "@/components/dashboard/card";
import { PageBanner } from "@/components/ui/page-banner";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/skeleton";
import { Glyph } from "@/components/glyph";

export const metadata = { title: "Loop Passport" };

async function Passport() {
  const me = await requireMe();
  const { t } = await getT();
  if (!me.isStudent) return <EmptyState scene="books" title={t("The Passport is for current students")}>{t("Alumni and staff do not collect a Passport.")}</EmptyState>;
  const supabase = await createClient();
  const [{ data: clubs }, { data: rsvps }, { data: vol }, { data: subs }, { data: badges }, { data: roles }] = await Promise.all([
    supabase.from("club_members").select("joined_at, club:clubs(id, name, emoji, status, image_path)").eq("profile_id", me.id),
    supabase.from("event_rsvps").select("event:events(id, title, starts_at, status)").eq("profile_id", me.id).limit(50),
    supabase.rpc("volunteer_history", { p_profile: me.id }),
    supabase.from("challenge_submissions").select("challenge:challenges(id, title)").eq("profile_id", me.id).eq("status", "approved").limit(50),
    supabase.from("profile_badges").select("earned_at, badge:badges(code, name, emoji)").eq("profile_id", me.id).order("earned_at", { ascending: false }),
    supabase.from("leadership_roles").select("id, kind, scope, club:clubs(name)").eq("profile_id", me.id),
  ]);
  const myClubs = (clubs ?? []).filter((c) => c.club && c.club.status === "approved");
  const clubImages = await signClubImages(supabase, myClubs.map((c) => c.club!.image_path));
  const events = (rsvps ?? []).map((r) => r.event).filter((e): e is NonNullable<typeof e> => !!e && e.status !== "cancelled").sort((a, b) => b.starts_at.localeCompare(a.starts_at));
  const hours = (vol ?? []).reduce((a, v) => a + Number(v.hours), 0);
  const challenges = (subs ?? []).map((s) => s.challenge).filter((c): c is NonNullable<typeof c> => !!c);
  const earned = (badges ?? []).filter((b) => b.badge);
  const stats: [string, number][] = [["Clubs", myClubs.length], ["Events", events.length], ["Volunteering hours", Math.round(hours * 10) / 10], ["Challenges done", challenges.length], ["Achievements", earned.length]];
  const empty = (text: string, href: string, label: string) => <EmptyState compact scene="community" title={text} action={{ href, label }} />;

  return (
    <div className="space-y-5" data-passport>
      <PageBanner title={t("Loop Passport")} subtitle={t("A record of everything you take part in.")} note={t("It fills up as you join clubs, go to events and help out.")} scene="campus" />
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-5" data-passport-stats>
        {stats.map(([label, n]) => <li key={label} className="card p-3 text-center"><p className="font-heading text-2xl font-semibold tabular-nums">{n}</p><p className="text-xs text-ink-2">{t(label)}</p></li>)}
      </ul>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <DashCard title={t("Clubs")} href="/clubs" linkLabel={t("See all")}>
          {myClubs.length === 0 ? empty(t("You have not joined a club yet"), "/clubs", t("Find a club")) : (
            <ul className="flex flex-wrap gap-2">{myClubs.map((c) => <li key={c.club!.id}><Link href={`/clubs/${c.club!.id}`} className="chip gap-1.5 bg-white shadow-sm"><ClubIcon emoji={c.club!.emoji} url={c.club!.image_path ? clubImages.get(c.club!.image_path) : null} className="size-5 text-xs" />{c.club!.name}</Link></li>)}</ul>
          )}
        </DashCard>
        <DashCard title={t("Events")} href="/events" linkLabel={t("See all")}>
          {events.length === 0 ? empty(t("No events yet"), "/events", t("Explore events")) : (
            <ul className="divide-y divide-black/5 text-sm">{events.slice(0, 6).map((e) => <li key={e.id}><Link href={`/events/${e.id}`} className="flex justify-between gap-3 py-2 hover:underline"><span className="truncate">{e.title}</span><span className="shrink-0 text-xs text-ink-2">{formatDate(e.starts_at)}</span></Link></li>)}</ul>
          )}
        </DashCard>
        <DashCard title={t("Volunteering")} href="/volunteering" linkLabel={t("See all")}>
          {(vol ?? []).length === 0 ? empty(t("No volunteering hours yet"), "/volunteering", t("Find an opportunity")) : (
            <p className="text-sm">{t("{n} verified hours so far.", { n: Math.round(hours * 10) / 10 })}</p>
          )}
        </DashCard>
        <DashCard title={t("Challenges")} href="/challenges" linkLabel={t("See all")}>
          {challenges.length === 0 ? empty(t("No completed challenges yet"), "/challenges", t("Browse challenges")) : (
            <ul className="space-y-1 text-sm">{challenges.slice(0, 6).map((c) => <li key={c.id}><Link href={`/challenges/${c.id}`} className="hover:underline"><Glyph e="✓" /> {c.title}</Link></li>)}</ul>
          )}
        </DashCard>
        <DashCard title={t("Achievements")} href="/points" linkLabel={t("See all")}>
          {earned.length === 0 ? empty(t("No achievements yet"), "/points", t("See what you can unlock")) : (
            <ul className="flex flex-wrap gap-2">{earned.map((b) => <li key={b.badge!.code} className="chip bg-white shadow-sm"><Glyph e={b.badge!.emoji} /> {t(b.badge!.name)}</li>)}</ul>
          )}
        </DashCard>
        <DashCard title={t("Roles and positions")} href="/leadership" linkLabel={t("Manage")}>
          {(roles ?? []).length === 0 ? <p className="text-sm text-ink-2">{t("You do not hold a role. Roles are approved by your school.")}</p> : (
            <ul className="flex flex-wrap gap-2">{(roles ?? []).map((r) => <li key={r.id} className="chip bg-brand-50 text-brand-800">{leadershipLabel(r.kind, r.scope, (r.club as unknown as { name: string } | null)?.name)}</li>)}</ul>
          )}
        </DashCard>
      </div>
    </div>
  );
}

export default function PassportPage() {
  return <Suspense fallback={<PageSkeleton />}><Passport /></Suspense>;
}
