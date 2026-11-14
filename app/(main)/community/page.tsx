import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyClubs } from "@/lib/dashboard";
import { loadFeed } from "@/lib/feed";
import { getT } from "@/lib/i18n-server";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
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
  const [clubs, posts, { data: trending }] = await Promise.all([
    getMyClubs(me.id),
    loadFeed(supabase, me.id, { feed: true, tag, limit: Math.min(shown, 50), offset: 0 }),
    supabase.rpc("trending_tags", { p_limit: 8 }),
  ]);
  // The database returns at most 50 at a time; load the rest in a second step.
  const more = shown > 50 ? await loadFeed(supabase, me.id, { feed: true, tag, limit: 50, offset: 50 }) : [];
  const all = [...posts, ...more].slice(0, shown);

  return (
    <div className="space-y-4">
      <PageHeader
        title={tag ? `#${tag}` : t("Community")}
        back={tag ? "/community" : undefined}
        action={<div className="flex gap-2"><Link href="/clubs" className="btn-secondary px-3 py-2">{t("Clubs")}</Link><Link href="/groups" className="btn-secondary px-3 py-2">{t("Groups")}</Link><Link href="/saved" className="btn-secondary px-3 py-2">{t("Saved")}</Link></div>}
      />
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
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
  );
}

export default function CommunityPage(props: PageProps<"/community">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Community searchParams={props.searchParams} />
    </Suspense>
  );
}
