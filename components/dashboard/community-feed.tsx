import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyClubs } from "@/lib/dashboard";
import { loadPosts } from "@/lib/queries";
import { CardEmpty, DashCard } from "@/components/dashboard/card";
import { FeedPostCard } from "@/components/dashboard/feed-post";
import { HomeComposer } from "@/components/dashboard/home-composer";

export async function CommunityFeed({ limit = 4 }: { limit?: number }) {
  const me = await requireMe();
  const supabase = await createClient();
  const clubs = await getMyClubs(me.id);
  const posts = await loadPosts(supabase, clubs.map((c) => c.id), limit);
  return (
    <DashCard title="Community Feed" href="/community">
      <HomeComposer clubs={clubs} avatar={me.avatar} schoolId={me.school_id} userId={me.id} />
      <div className="mt-4">
        {clubs.length > 0 && posts.length === 0 ? (
          <CardEmpty icon="pencil">No posts yet. Be the first to post in one of your clubs.</CardEmpty>
        ) : posts.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {posts.map((p) => (
              <FeedPostCard key={p.id} post={p} meId={me.id} />
            ))}
          </div>
        ) : (
          <p className="text-center text-sm text-ink-2">
            <Link href="/clubs" className="font-semibold text-brand-700 hover:underline">Browse the clubs</Link> to see what your school is sharing.
          </p>
        )}
      </div>
    </DashCard>
  );
}
