import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate, localDayKey, weekStart } from "@/lib/time";
import { deleteChallenge, withdrawSubmission } from "@/app/actions/challenges";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { SubmitButton } from "@/components/submit-button";
import { CreateChallengeForm } from "./create-form";
import { SubmitChallengeForm } from "./submit-form";

export const metadata = { title: "Weekly challenge" };

const STATUS = {
  pending: { text: "⏳ Waiting for a moderator", cls: "bg-amber-50 text-amber-800" },
  approved: { text: "✅ Done! Points added for your grade", cls: "bg-brand-50 text-brand-800" },
  rejected: { text: "Not accepted", cls: "bg-red-50 text-red-700" },
};

async function Challenges() {
  const me = await requireMe();
  const supabase = await createClient();
  const now = new Date().toISOString();
  const [{ data: challenges }, { data: mine }] = await Promise.all([
    supabase.from("challenges").select("*").order("starts_at", { ascending: false }).limit(20),
    supabase.from("challenge_submissions").select("id, challenge_id, status, review_note").eq("profile_id", me.id),
  ]);
  const all = challenges ?? [];
  const current = all.filter((c) => c.starts_at <= now && c.ends_at > now);
  const upcoming = all.filter((c) => c.starts_at > now);
  const past = all.filter((c) => c.ends_at <= now);
  const myByChallenge = new Map((mine ?? []).map((s) => [s.challenge_id, s]));
  const counts = await Promise.all(current.map((c) => supabase.rpc("challenge_completions", { p_challenge: c.id })));

  const start = weekStart();
  const lastDay = new Date(start.getTime() + 6 * 24 * 3600 * 1000);

  return (
    <div className="space-y-5">
      <p className="text-sm text-black/55">
        Complete a challenge to earn points for <strong>your grade</strong> on the{" "}
        <Link href="/leaderboard" className="text-brand-700 underline">leaderboard</Link>.
      </p>

      {me.isStaff && <CreateChallengeForm defaultStart={localDayKey(start)} defaultEnd={localDayKey(lastDay)} />}

      {current.length === 0 && <Empty emoji="🏁" title="No challenge this week yet">Check back soon!</Empty>}
      {current.map((c, i) => {
        const sub = myByChallenge.get(c.id);
        return (
          <article key={c.id} className="card space-y-3 p-4">
            <div className="flex items-start gap-3">
              <span className="text-3xl">{c.emoji}</span>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold">{c.title}</h2>
                <p className="text-xs text-black/50">
                  +{c.points} points · until {formatShortDate(new Date(new Date(c.ends_at).getTime() - 1))} ·{" "}
                  {counts[i].data ?? 0} completed
                </p>
              </div>
            </div>
            {c.description && <p className="text-sm whitespace-pre-wrap text-black/75">{c.description}</p>}
            {sub ? (
              <div className="flex items-center justify-between gap-2">
                <span className={`chip ${STATUS[sub.status as keyof typeof STATUS].cls}`}>
                  {STATUS[sub.status as keyof typeof STATUS].text}
                </span>
                {sub.status === "pending" && (
                  <form action={withdrawSubmission}>
                    <input type="hidden" name="id" value={sub.id} />
                    <SubmitButton className="text-xs text-black/40 hover:text-red-600" pendingText="…">Take back</SubmitButton>
                  </form>
                )}
              </div>
            ) : me.isStudent && !me.isSuspended ? (
              <SubmitChallengeForm challengeId={c.id} schoolId={me.school_id} userId={me.id} />
            ) : null}
            {sub?.review_note && <p className="text-xs text-black/55">Moderator: {sub.review_note}</p>}
          </article>
        );
      })}

      {upcoming.length > 0 && (
        <section>
          <h2 className="section-title">Coming up</h2>
          {upcoming.map((c) => (
            <p key={c.id} className="card mb-2 p-3 text-sm">{c.emoji} {c.title} · starts {formatShortDate(c.starts_at)}</p>
          ))}
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="section-title">Past challenges</h2>
          <ul className="card divide-y divide-black/5 text-sm">
            {past.map((c) => (
              <li key={c.id} className="flex items-center gap-2 px-4 py-2.5">
                <span>{c.emoji}</span>
                <span className="flex-1">{c.title}</span>
                <span className="text-xs text-black/45">{myByChallenge.get(c.id)?.status === "approved" ? "✅ done" : formatShortDate(c.starts_at)}</span>
                {me.isStaff && (
                  <form action={deleteChallenge}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="text-xs text-black/30 hover:text-red-600" aria-label="Delete challenge">✕</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function ChallengesPage() {
  return (
    <>
      <PageHeader title="Weekly challenge" back="/more" />
      <Suspense fallback={<PageSkeleton />}>
        <Challenges />
      </Suspense>
    </>
  );
}
