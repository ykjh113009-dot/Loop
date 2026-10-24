import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClubCard, type ClubSummary } from "@/components/club-card";
import { Empty } from "@/components/empty";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Clubs" };

const STATUS_LABEL: Record<string, string> = {
  pending: "Waiting for a moderator",
  rejected: "Not approved",
  archived: "Closed",
};

async function Clubs({ searchParams }: { searchParams: PageProps<"/clubs">["searchParams"] }) {
  const me = await requireMe();
  const supabase = await createClient();
  const [{ data: clubs }, { data: memberships }, { data: myRequests }] = await Promise.all([
    supabase.from("clubs").select("id, name, emoji, description, status, club_members(count)").eq("status", "approved").order("name"),
    supabase.from("club_members").select("club_id").eq("profile_id", me.id),
    supabase.from("clubs").select("id, name, emoji, status, review_note").eq("requested_by", me.id).neq("status", "approved"),
  ]);
  const { requested } = await searchParams;
  const mine = new Set((memberships ?? []).map((m) => m.club_id));
  const all = (clubs ?? []) as ClubSummary[];
  const joined = all.filter((c) => mine.has(c.id));
  const others = all.filter((c) => !mine.has(c.id));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clubs"
        action={
          !me.isSuspended && (
            <Link href="/clubs/new" className="btn-primary px-3 py-2">
              <Icon name="plus" className="size-4" /> Request a club
            </Link>
          )
        }
      />

      {requested && (
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">
          🎉 Your club request was sent. A moderator will review it and you&apos;ll get a notification.
        </p>
      )}

      {myRequests && myRequests.length > 0 && (
        <section>
          <h2 className="section-title">Your requests</h2>
          <div className="space-y-2">
            {myRequests.map((r) => (
              <div key={r.id} className="card flex items-center gap-3 p-3 text-sm">
                <span className="text-xl">{r.emoji}</span>
                <span className="flex-1 font-medium">{r.name}</span>
                <span className="text-xs text-black/50">{STATUS_LABEL[r.status]}{r.review_note ? ` — ${r.review_note}` : ""}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">My clubs</h2>
        {joined.length ? (
          <div className="space-y-2">{joined.map((c) => <ClubCard key={c.id} club={c} joined />)}</div>
        ) : (
          <Empty emoji="🧭" title="You're not in any club yet">Pick one below and tap Join.</Empty>
        )}
      </section>

      <section>
        <h2 className="section-title">Discover</h2>
        {others.length ? (
          <div className="space-y-2">{others.map((c) => <ClubCard key={c.id} club={c} />)}</div>
        ) : (
          <Empty emoji="✨" title="You've joined every club!" />
        )}
      </section>
    </div>
  );
}

export default function ClubsPage(props: PageProps<"/clubs">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Clubs searchParams={props.searchParams} />
    </Suspense>
  );
}
