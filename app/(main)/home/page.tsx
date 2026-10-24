import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { EVENT_FIELDS, loadPosts, type EventSummary } from "@/lib/queries";
import { timeAgo } from "@/lib/time";
import { PostCard } from "@/components/post-card";
import { EventCard } from "@/components/event-card";
import { Empty } from "@/components/empty";
import { Icon } from "@/components/icons";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Home" };

async function Home() {
  const me = await requireMe();
  const supabase = await createClient();

  const [{ data: announcements }, { data: memberships }, { data: events }, { data: myRsvps }] = await Promise.all([
    supabase.from("announcements").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(2),
    supabase.from("club_members").select("club_id").eq("profile_id", me.id),
    supabase
      .from("events")
      .select(EVENT_FIELDS)
      .eq("status", "approved")
      .gt("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(3),
    supabase.from("event_rsvps").select("event_id").eq("profile_id", me.id),
  ]);

  const clubIds = (memberships ?? []).map((m) => m.club_id);
  const goingTo = new Set((myRsvps ?? []).map((r) => r.event_id));
  const posts = await loadPosts(supabase, clubIds, 20);

  return (
    <div className="space-y-6">
      <h1 className="page-title">Hi {me.full_name.split(" ")[0]} 👋</h1>

      {announcements && announcements.length > 0 && (
        <section className="space-y-2">
          {announcements.map((a) => (
            <article key={a.id} className="rounded-2xl bg-brand-700 p-4 text-white shadow-sm">
              <p className="flex items-center gap-2 text-xs font-semibold tracking-wide text-white/70 uppercase">
                <Icon name="megaphone" className="size-4" /> School announcement · {timeAgo(a.created_at)}
              </p>
              <h2 className="mt-1 font-bold">{a.title}</h2>
              <p className="mt-1 line-clamp-3 text-sm whitespace-pre-wrap text-white/90">{a.body}</p>
            </article>
          ))}
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="section-title">Coming up</h2>
          <Link href="/events" className="text-sm font-medium text-brand-700">Calendar →</Link>
        </div>
        <div className="space-y-2">
          {(events as EventSummary[] | null)?.length ? (
            (events as EventSummary[]).map((e) => <EventCard key={e.id} event={e} going={goingTo.has(e.id)} />)
          ) : (
            <Empty emoji="📅" title="No upcoming events yet" />
          )}
        </div>
      </section>

      <section>
        <h2 className="section-title">From your clubs</h2>
        {clubIds.length === 0 ? (
          <Empty emoji="🧭" title="You haven't joined any clubs yet">
            <Link href="/clubs" className="btn-primary mt-3">Find a club</Link>
          </Empty>
        ) : posts.length === 0 ? (
          <Empty emoji="✏️" title="No posts yet">Be the first to post in one of your clubs.</Empty>
        ) : (
          <div className="space-y-3">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} meId={me.id} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Home />
    </Suspense>
  );
}
