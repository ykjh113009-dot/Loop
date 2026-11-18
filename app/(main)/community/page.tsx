import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyClubs } from "@/lib/dashboard";
import { loadFeed } from "@/lib/feed";
import { getT } from "@/lib/i18n-server";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageBanner } from "@/components/ui/page-banner";
import { SectionTabs } from "@/components/ui/section-tabs";
import { DashCard } from "@/components/dashboard/card";
import { QuickChats } from "@/components/dashboard/quick-chats";
import { PageSkeleton } from "@/components/skeleton";
import { FeedPostCard } from "@/components/dashboard/feed-post";
import { HomeComposer } from "@/components/dashboard/home-composer";

export const metadata = { title: "Community" };
const PAGE = 20;

async function Community({ searchParams }: { searchParams: PageProps<"/community">["searchParams"] }) {
  const me = await requireMe();
  const params = await searchParams;
  const tag = typeof params.tag === "string" ? params.tag.toLowerCase().slice(0, 40) : null;
  const shown = Math.min(Math.max(Number(params.show) || PAGE, PAGE), 200);
  const supabase = await createClient();
  const { t, locale } = await getT();
  const [clubs, posts, { data: trending }, { data: groups }, { data: allClubs }, { data: joined }] = await Promise.all([
    getMyClubs(me.id),
    loadFeed(supabase, me.id, { feed: true, tag, limit: Math.min(shown, 50), offset: 0 }),
    supabase.rpc("trending_tags", { p_limit: 8 }),
    supabase.from("groups").select("id, name, emoji, member_count").eq("status", "active").eq("privacy", "public").order("member_count", { ascending: false }).limit(4),
    supabase.from("clubs").select("id, name, emoji, club_members(count)").eq("status", "approved").limit(30),
    supabase.from("club_members").select("club_id").eq("profile_id", me.id),
  ]);
  const mine = new Set((joined ?? []).map((j) => j.club_id));
  const suggested = (allClubs ?? []).filter((c) => !mine.has(c.id)).slice(0, 3);
  // The database returns at most 50 at a time; load the rest in a second step.
  const more = shown > 50 ? await loadFeed(supabase, me.id, { feed: true, tag, limit: 50, offset: 50 }) : [];
  const all = [...posts, ...more].slice(0, shown);

  return (
    <div className="space-y-4" data-category-page="community">
      {tag ? (
        <PageHeader title={`#${tag}`} back="/community" />
      ) : (
        <>
          <PageBanner title={t("Community")} subtitle={t("Connect · Share · Belong")} note={t("Be part of our amazing school community!")} scene="community" />
          <SectionTabs label={t("Community")} current="/community" items={[
            { href: "/community", label: t("All Posts"), icon: "feed" }, { href: "/messages", label: t("Chats"), icon: "chat" }, { href: "/groups", label: t("Groups"), icon: "groups" },
            { href: "/clubs", label: t("Clubs"), icon: "clubs" }, { href: "/polls", label: t("Polls"), icon: "star" }, { href: "/saved", label: t("Saved"), icon: "yearbook" },
          ]} />
        </>
      )}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-4">
      {!tag && !me.isSuspended && (
        <div className="card p-4">
          <HomeComposer clubs={clubs} avatar={me.avatar} schoolId={me.school_id} userId={me.id} locale={locale} />
        </div>
      )}
      {(trending ?? []).length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="text-ink-2">{t("Trending")}:</span>
          {(trending ?? []).map((x) => (
            <Link key={x.tag} href={`/community?tag=${encodeURIComponent(x.tag)}`} className={`chip ${x.tag === tag ? "bg-brand-700 text-white" : "bg-brand-50 text-brand-900 hover:bg-brand-100"}`}>
              #{x.tag}
            </Link>
          ))}
        </div>
      )}
      {all.length === 0 ? (
        <Empty emoji="✏️" title={t("No posts yet")}>{t("Be the first to share something with your school.")}</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
          {all.map((p) => (
            <FeedPostCard key={p.id} post={p} meId={me.id} locale={locale} />
          ))}
        </div>
      )}
      {all.length >= shown && shown < 200 && (
        <div className="text-center">
          <Link href={`/community?${tag ? `tag=${encodeURIComponent(tag)}&` : ""}show=${shown + PAGE}`} scroll={false} className="btn-secondary">
            {t("Show more")}
          </Link>
        </div>
      )}
      </div>
      <aside className="space-y-4" aria-label={t("Community highlights")}>
        <DashCard title={t("Trending Groups")} href="/groups" linkLabel={t("See all")}>
          {(groups ?? []).length === 0 ? (
            <p className="text-sm text-ink-2">{t("No groups yet? Be the first to start one!")} <Link href="/groups/new" className="font-semibold text-brand-700 hover:underline">{t("Create a Group")}</Link></p>
          ) : (
            <ul className="space-y-1" data-card="groups">{(groups ?? []).map((g) => (
              <li key={g.id}><Link href={`/groups/${g.id}`} className="flex items-center gap-3 rounded-xl px-1.5 py-1.5 hover:bg-brand-50"><span className="flex size-9 items-center justify-center rounded-xl bg-sage-soft/70 text-lg">{g.emoji}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{g.name}</span><span className="text-xs text-ink-2">{t("{n} members", { n: g.member_count })}</span></span></Link></li>
            ))}</ul>
          )}
        </DashCard>
        <DashCard title={t("Suggested Clubs")} href="/clubs" linkLabel={t("See all")}>
          {suggested.length === 0 ? (
            <p className="text-sm text-ink-2">{t("You are in every club. Want a new one?")} <Link href="/clubs/new" className="font-semibold text-brand-700 hover:underline">{t("Request a club")}</Link></p>
          ) : (
            <ul className="space-y-1" data-card="clubs">{suggested.map((c) => (
              <li key={c.id}><Link href={`/clubs/${c.id}`} className="flex items-center gap-3 rounded-xl px-1.5 py-1.5 hover:bg-brand-50"><span className="flex size-9 items-center justify-center rounded-xl bg-sage-soft/70 text-lg">{c.emoji}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{c.name}</span><span className="text-xs text-ink-2">{t("{n} members", { n: c.club_members?.[0]?.count ?? 0 })}</span></span></Link></li>
            ))}</ul>
          )}
        </DashCard>
        <Suspense fallback={null}><QuickChats /></Suspense>
      </aside>
      </div>
    </div>
  );
}

export default function CommunityPage(props: PageProps<"/community">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Community searchParams={props.searchParams} />
    </Suspense>
  );
}
