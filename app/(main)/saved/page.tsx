import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadFeed } from "@/lib/feed";
import { getT } from "@/lib/i18n-server";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { FeedPostCard } from "@/components/dashboard/feed-post";

export const metadata = { title: "Saved" };

async function Saved() {
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data: saves } = await supabase.from("post_saves").select("post_id").eq("profile_id", me.id).order("created_at", { ascending: false }).limit(100);
  const posts = await loadFeed(supabase, me.id, { ids: (saves ?? []).map((s) => s.post_id) });
  return (
    <>
      <PageHeader title={t("Saved")} back="/community" />
      {posts.length === 0 ? (
        <Empty emoji="🔖" title={t("Nothing saved yet")}>{t("Tap the bookmark on a post to keep it here. Only you can see this list.")}</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {posts.map((p) => <FeedPostCard key={p.id} post={p} meId={me.id} locale={locale} />)}
        </div>
      )}
    </>
  );
}

export default function SavedPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Saved />
    </Suspense>
  );
}
