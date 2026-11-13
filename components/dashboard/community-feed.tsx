import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyClubs } from "@/lib/dashboard";
import { loadFeed } from "@/lib/feed";
import { getT } from "@/lib/i18n-server";
import { CardEmpty, DashCard } from "@/components/dashboard/card";
import { FeedPostCard } from "@/components/dashboard/feed-post";
import { HomeComposer } from "@/components/dashboard/home-composer";

export async function CommunityFeed({ limit = 4 }: { limit?: number }) {
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const [clubs, posts] = await Promise.all([getMyClubs(me.id), loadFeed(supabase, me.id, { feed: true, limit })]);
  return (
    <DashCard title={t("Community Feed")} href="/community">
      {!me.isSuspended && <HomeComposer clubs={clubs} avatar={me.avatar} schoolId={me.school_id} userId={me.id} locale={locale} />}
      <div className="mt-4">
        {posts.length === 0 ? (
          <CardEmpty icon="pencil">{t("No posts yet. Be the first to share something with your school.")}</CardEmpty>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {posts.map((p) => (
              <FeedPostCard key={p.id} post={p} meId={me.id} locale={locale} />
            ))}
          </div>
        )}
      </div>
    </DashCard>
  );
}
