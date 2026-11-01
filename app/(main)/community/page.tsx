import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getMyClubs } from "@/lib/dashboard";
import { loadPosts } from "@/lib/queries";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { FeedPostCard } from "@/components/dashboard/feed-post";
import { HomeComposer } from "@/components/dashboard/home-composer";

export const metadata = { title: "Community" };

async function Community() {
  const me = await requireMe();
  const supabase = await createClient();
  const clubs = await getMyClubs(me.id);
  const posts = await loadPosts(supabase, clubs.map((c) => c.id), 50);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Community"
        action={<Link href="/clubs" className="btn-secondary px-3 py-2">Browse clubs</Link>}
      />
      <div className="card p-4">
        <HomeComposer clubs={clubs} avatar={me.avatar} schoolId={me.school_id} userId={me.id} />
      </div>
      {clubs.length > 0 && posts.length === 0 ? (
        <Empty emoji="✏️" title="No posts yet">Be the first to post in one of your clubs.</Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {posts.map((p) => (
            <FeedPostCard key={p.id} post={p} meId={me.id} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommunityPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Community />
    </Suspense>
  );
}
