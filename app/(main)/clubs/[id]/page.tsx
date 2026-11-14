import { Suspense } from "react";
import Link from "next/link";
import { getClub } from "@/lib/clubs";
import { createClient } from "@/lib/supabase/server";
import { EVENT_FIELDS, loadPosts, type EventSummary } from "@/lib/queries";
import { PostCard } from "@/components/post-card";
import { PostComposer } from "@/components/post-composer";
import { EventCard } from "@/components/event-card";
import { Empty } from "@/components/empty";
import { PageSkeleton } from "@/components/skeleton";
import { SpaceComposer } from "@/components/space-composer";
import { getLocale } from "@/lib/i18n-server";

async function Feed({ params }: { params: PageProps<"/clubs/[id]">["params"] }) {
  const { id } = await params;
  const { me, club, isMember, isLeader } = await getClub(id);
  if (club.status !== "approved") return null;

  const supabase = await createClient();
  const locale = await getLocale();
  const [allPosts, { data: events }] = await Promise.all([
    loadPosts(supabase, [club.id], 40),
    supabase
      .from("events")
      .select(EVENT_FIELDS)
      .eq("club_id", club.id)
      .in("status", ["approved", "pending"])
      .gt("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(3),
  ]);

  // Announcements stay on top.
  const posts = [...allPosts].sort((a, b) => Number(b.kind === "announcement") - Number(a.kind === "announcement"));

  return (
    <div className="space-y-4">
      {((events as EventSummary[] | null)?.length || isLeader) && (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="section-title">Club events</h2>
            {isLeader && !me.isSuspended && (
              <Link href={`/events/new?club=${club.id}`} className="text-sm font-medium text-brand-700">+ Suggest an event</Link>
            )}
          </div>
          <div className="space-y-2">
            {(events as EventSummary[]).map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        </section>
      )}

      {isLeader && !me.isSuspended && (
        <details className="card p-3">
          <summary className="cursor-pointer text-sm font-semibold text-brand-700">📣 Send an announcement to every member</summary>
          <div className="mt-3"><SpaceComposer type="club" spaceId={club.id} canAnnounce locale={locale} /></div>
        </details>
      )}
      {isMember && !me.isSuspended && <PostComposer clubId={club.id} schoolId={me.school_id} userId={me.id} />}

      {posts.length === 0 ? (
        <Empty emoji="✏️" title="No posts yet">{isMember ? "Say hello to the club!" : "Join the club to post."}</Empty>
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} meId={me.id} showClub={false} />)
      )}
    </div>
  );
}

export default function ClubFeedPage(props: PageProps<"/clubs/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Feed params={props.params} />
    </Suspense>
  );
}
