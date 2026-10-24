import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Empty } from "@/components/empty";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { PollCard } from "@/components/poll-card";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Polls" };

async function Polls() {
  const me = await requireMe();
  const supabase = await createClient();
  const [{ data: polls }, { count: leaderOf }] = await Promise.all([
    supabase
      .from("polls")
      .select("id, question, options, closes_at, created_by, club:clubs(name, emoji)")
      .order("closes_at", { ascending: false })
      .limit(30),
    supabase.from("club_members").select("club_id", { count: "exact", head: true }).eq("profile_id", me.id).eq("role", "leader"),
  ]);
  const now = new Date().toISOString();
  const open = (polls ?? []).filter((p) => p.closes_at > now).reverse();
  const closed = (polls ?? []).filter((p) => p.closes_at <= now);
  const canCreate = !me.isSuspended && (me.isStaff || (leaderOf ?? 0) > 0);
  const canVote = me.isStudent && !me.isSuspended;

  return (
    <div className="space-y-5">
      {canCreate && (
        <Link href="/polls/new" className="btn-primary w-full">
          <Icon name="plus" className="size-4" /> New poll
        </Link>
      )}
      <section className="space-y-3">
        <h2 className="section-title">Open</h2>
        {open.length === 0 ? <Empty emoji="📊" title="No open polls right now" /> : open.map((p) => (
          <PollCard key={p.id} poll={p} canVote={canVote} canDelete={me.isStaff || p.created_by === me.id} />
        ))}
      </section>
      {closed.length > 0 && (
        <section className="space-y-3">
          <h2 className="section-title">Closed</h2>
          {closed.map((p) => (
            <PollCard key={p.id} poll={p} canVote={false} canDelete={me.isStaff} />
          ))}
        </section>
      )}
    </div>
  );
}

export default function PollsPage() {
  return (
    <>
      <PageHeader title="Polls" back="/more" />
      <Suspense fallback={<PageSkeleton />}>
        <Polls />
      </Suspense>
    </>
  );
}
