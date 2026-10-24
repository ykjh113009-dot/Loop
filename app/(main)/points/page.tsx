import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { POINT_REASONS } from "@/lib/points";
import { timeAgo, weekStart } from "@/lib/time";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "My points" };

async function Points() {
  const me = await requireMe();
  const supabase = await createClient();
  const [{ data: ledger }, { data: badges }, { data: mine }] = await Promise.all([
    supabase.from("points_ledger").select("id, points, reason, created_at").eq("profile_id", me.id).order("created_at", { ascending: false }),
    supabase.from("badges").select("code, name, emoji, description").order("sort"),
    supabase.from("profile_badges").select("badge_code, earned_at").eq("profile_id", me.id),
  ]);
  const rows = ledger ?? [];
  const total = rows.reduce((sum, r) => sum + r.points, 0);
  const since = weekStart().toISOString();
  const week = rows.filter((r) => r.created_at >= since).reduce((sum, r) => sum + r.points, 0);
  const earned = new Map((mine ?? []).map((b) => [b.badge_code, b.earned_at]));

  if (!me.isStudent) {
    return <p className="text-sm text-black/60">Points are for current students. Alumni and staff don&apos;t collect points.</p>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="card bg-brand-700 p-4 text-white">
          <p className="text-xs text-white/75">This week</p>
          <p className="text-3xl font-bold tabular-nums">{week}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-black/50">All time</p>
          <p className="text-3xl font-bold tabular-nums">{total}</p>
        </div>
      </div>
      <p className="text-sm text-black/55">
        Your points are private — only you can see them. They add up for <strong>grade {me.grade}</strong> on the{" "}
        <Link href="/leaderboard" className="text-brand-700 underline">grade leaderboard</Link>.
      </p>

      <section>
        <h2 className="section-title">Badges ({earned.size}/{badges?.length ?? 0})</h2>
        <div className="grid grid-cols-3 gap-2">
          {(badges ?? []).map((b) => {
            const has = earned.has(b.code);
            return (
              <div key={b.code} className={`card p-3 text-center ${has ? "" : "opacity-45 grayscale"}`} title={b.description}>
                <div className="text-3xl">{b.emoji}</div>
                <p className="mt-1 text-xs leading-tight font-semibold">{b.name}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-black/50">{b.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="section-title">How to earn points</h2>
        <ul className="card divide-y divide-black/5 text-sm">
          {[
            ["Weekly challenge", "15–30"],
            ["Tutor a classmate", "15"],
            ["Volunteering", "10 per hour"],
            ["Join a club", "5"],
            ["Go to an event (RSVP)", "3"],
            ["Answer a Tawjihi question", "3"],
            ["Vote in an election", "3"],
            ["Post in a club", "2"],
            ["Send a suggestion", "2"],
            ["Vote in a poll", "1"],
          ].map(([what, pts]) => (
            <li key={what} className="flex justify-between px-4 py-2">
              <span>{what}</span>
              <span className="font-semibold tabular-nums text-brand-700">+{pts}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="section-title">History</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-black/50">No points yet — join a club to get started!</p>
        ) : (
          <ul className="card divide-y divide-black/5 text-sm">
            {rows.slice(0, 40).map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-2">
                <span>{POINT_REASONS[r.reason] ?? r.reason}</span>
                <span className="text-xs text-black/40">{timeAgo(r.created_at)}</span>
                <span className="w-10 text-right font-semibold tabular-nums text-brand-700">+{r.points}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function PointsPage() {
  return (
    <>
      <PageHeader title="My points & badges" back="/more" />
      <Suspense fallback={<PageSkeleton />}>
        <Points />
      </Suspense>
    </>
  );
}
