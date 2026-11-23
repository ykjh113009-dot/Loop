import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Empty } from "@/components/empty";
import { BarChart3 } from "lucide-react";
import { ImageBanner } from "@/components/ui/image-banner";
import { SectionTabs } from "@/components/ui/section-tabs";
import { PollCard } from "@/components/poll-card";
import { contentPowers } from "@/lib/content-powers";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Polls" };

const TABS = [["", "Active Polls"], ["ended", "Ended Polls"], ["mine", "My Polls"]] as const;

async function Polls({ searchParams }: { searchParams: PageProps<"/polls">["searchParams"] }) {
  const me = await requireMe();
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "ended" || rawTab === "mine" ? rawTab : "";
  const supabase = await createClient();
  const [{ data: polls }, { count: leaderOf }] = await Promise.all([
    supabase
      .from("polls")
      .select("id, question, options, closes_at, created_by, club:clubs(id, name, emoji, image_path)")
      .order("closes_at", { ascending: false })
      .limit(40),
    supabase.from("club_members").select("club_id", { count: "exact", head: true }).eq("profile_id", me.id).eq("role", "leader"),
  ]);
  const now = new Date().toISOString();
  const all = polls ?? [];
  const shown = tab === "ended" ? all.filter((p) => p.closes_at <= now) : tab === "mine" ? all.filter((p) => p.created_by === me.id) : all.filter((p) => p.closes_at > now).reverse();
  const canCreate = !me.isSuspended && (me.isStaff || (leaderOf ?? 0) > 0);
  const canVote = me.isStudent && !me.isSuspended;
  const href = (k: string) => `/polls${k ? `?tab=${k}` : ""}`;
  const empty = tab === "ended" ? "No ended polls yet" : tab === "mine" ? "You have not made a poll yet" : "No open polls right now";

  return (
    <div className="space-y-5" data-polls-page data-wide>
      <ImageBanner name="community" title="Polls" subtitle="See your polls and vote in ongoing ones!" />
      <SectionTabs label="Polls" current={href(tab)} items={TABS.map(([k, label]) => ({ href: href(k), label }))} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 space-y-3">
          {shown.length === 0 ? <Empty emoji="📊" title={empty}>Polls from clubs and your school show up here. You can also add a poll to a post in the feed.</Empty> : shown.map((p) => (
            <PollCard key={p.id} poll={p} canVote={canVote && p.closes_at > now} canDelete={me.isStaff || p.created_by === me.id} staff={me.isStaff ? contentPowers(me, "poll") : undefined} />
          ))}
        </section>
        <aside className="h-fit space-y-3 rounded-3xl border border-brand-700/10 bg-white/85 p-5 text-center" aria-label="Create a poll">
          <h2 className="text-[17px] font-semibold">Create a Poll</h2>
          <BarChart3 className="mx-auto size-16 text-brand-700/70" strokeWidth={1.4} aria-hidden="true" />
          <p className="text-sm text-ink-2">Ask your community a question!</p>
          <Link href={canCreate ? "/polls/new" : "/home#composer"} className="btn-primary w-full justify-center rounded-full py-2.5">{canCreate ? "Create Poll" : "Add a poll to a post"}</Link>
        </aside>
      </div>
    </div>
  );
}

export default function PollsPage(props: PageProps<"/polls">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Polls searchParams={props.searchParams} />
    </Suspense>
  );
}
