import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadFeed } from "@/lib/feed";
import { getT } from "@/lib/i18n-server";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { contentPowers } from "@/lib/content-powers";
import { FeedPostCard } from "@/components/dashboard/feed-post";

export const metadata = { title: "Community" };
const PAGE = 20;

// The general feed lives on Home. This address now opens the Clubs page, except for hashtag links (#tag),
// which show the posts that use that tag.
async function Tagged({ searchParams }: { searchParams: PageProps<"/community">["searchParams"] }) {
  const me = await requireMe();
  const params = await searchParams;
  const tag = typeof params.tag === "string" ? params.tag.toLowerCase().slice(0, 40) : null;
  if (!tag) redirect("/clubs");
  const shown = Math.min(Math.max(Number(params.show) || PAGE, PAGE), 200);
  const supabase = await createClient();
  const { t, locale } = await getT();
  const posts = await loadFeed(supabase, me.id, { feed: true, tag, limit: Math.min(shown, 50), offset: 0 });
  const more = shown > 50 ? await loadFeed(supabase, me.id, { feed: true, tag, limit: 50, offset: 50 }) : [];
  const all = [...posts, ...more].slice(0, shown);
  return (
    <div className="mx-auto max-w-3xl space-y-4" data-wide>
      <PageHeader title={`#${tag}`} back="/home" />
      {all.length === 0 ? (
        <Empty emoji="✏️" title={t("No posts yet")}>{t("Be the first to share something with your school.")}</Empty>
      ) : (
        <div className="space-y-4">{all.map((p) => <FeedPostCard key={p.id} post={p} meId={me.id} locale={locale} wide staff={me.isStaff ? contentPowers(me, "post") : undefined} />)}</div>
      )}
      {all.length >= shown && shown < 200 && (
        <div className="text-center">
          <Link href={`/community?tag=${encodeURIComponent(tag)}&show=${shown + PAGE}`} scroll={false} className="btn-secondary">{t("Show more")}</Link>
        </div>
      )}
    </div>
  );
}

export default function CommunityPage(props: PageProps<"/community">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Tagged searchParams={props.searchParams} />
    </Suspense>
  );
}
