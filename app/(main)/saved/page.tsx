import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadFeed } from "@/lib/feed";
import { getT } from "@/lib/i18n-server";
import { RESOURCE_COLUMNS, signCovers, type LibraryResource } from "@/lib/library";
import { Empty } from "@/components/empty";
import { PageSkeleton } from "@/components/skeleton";
import { FeedPostCard } from "@/components/dashboard/feed-post";
import { ResourceCard } from "@/components/library/resource-card";
import { ImageBanner } from "@/components/ui/image-banner";
import { SectionTabs } from "@/components/ui/section-tabs";

export const metadata = { title: "Saved" };

const TABS = [["", "Posts"], ["polls", "Polls"], ["resources", "Resources"]] as const;

async function Saved({ searchParams }: { searchParams: PageProps<"/saved">["searchParams"] }) {
  const me = await requireMe();
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "polls" || rawTab === "resources" ? rawTab : "";
  const supabase = await createClient();
  const { t, locale } = await getT();
  const href = (k: string) => `/saved${k ? `?tab=${k}` : ""}`;
  const header = (
    <>
      <ImageBanner name="community" title="Saved" subtitle="Your saved posts, polls and resources" />
      <SectionTabs label={t("Saved")} current={href(tab)} items={TABS.map(([k, label]) => ({ href: href(k), label: t(label) }))} />
    </>
  );

  if (tab === "resources") {
    const { data: saves } = await supabase.from("library_saves").select("resource_id").eq("profile_id", me.id).order("created_at", { ascending: false }).limit(60);
    const ids = (saves ?? []).map((s) => s.resource_id);
    const { data } = ids.length ? await supabase.from("library_resources").select(RESOURCE_COLUMNS).in("id", ids).eq("visibility", "visible").is("deleted_at", null) : { data: [] };
    const rows = (data ?? []) as unknown as LibraryResource[];
    const covers = await signCovers(supabase, rows.map((r) => r.cover_path));
    return (
      <div className="space-y-5" data-saved-page data-wide>
        {header}
        {rows.length === 0 ? (
          <Empty emoji="📚" title={t("No saved resources yet")}>{t("Tap Save on a study resource to keep it here. Only you can see this list.")}</Empty>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-card="resources">{rows.map((r) => <ResourceCard key={r.id} r={r} cover={r.cover_path ? covers.get(r.cover_path) ?? null : null} t={t} />)}</div>
        )}
      </div>
    );
  }

  const { data: saves } = await supabase.from("post_saves").select("post_id").eq("profile_id", me.id).order("created_at", { ascending: false }).limit(100);
  const all = await loadFeed(supabase, me.id, { ids: (saves ?? []).map((s) => s.post_id) });
  const posts = all.filter((p) => (tab === "polls" ? p.kind === "poll" : p.kind !== "poll"));
  return (
    <div className="space-y-5" data-saved-page data-wide>
      {header}
      {posts.length === 0 ? (
        <Empty emoji="🔖" title={t(tab === "polls" ? "No saved polls yet" : "Nothing saved yet")}>{t("Tap the bookmark on a post to keep it here. Only you can see this list.")}</Empty>
      ) : (
        <div className="mx-auto max-w-3xl space-y-4">{posts.map((p) => <FeedPostCard key={p.id} post={p} meId={me.id} locale={locale} wide />)}</div>
      )}
    </div>
  );
}

export default function SavedPage(props: PageProps<"/saved">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Saved searchParams={props.searchParams} />
    </Suspense>
  );
}
