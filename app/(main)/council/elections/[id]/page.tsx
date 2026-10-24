import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { addCandidate, deleteElection, removeCandidate, updateStatement } from "@/app/actions/council";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { StudentPicker } from "@/components/student-picker";
import { SubmitButton } from "@/components/submit-button";
import { Ballot } from "./ballot";

type Summary = { turnout: number; voted: boolean; results: { candidate_id: string; votes: number }[] | null };

async function Election({ params }: { params: PageProps<"/council/elections/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const [{ data: e }, { data: candidates }, { data: summary }] = await Promise.all([
    supabase.from("elections").select("*").eq("id", id).maybeSingle(),
    supabase.from("election_candidates").select("id, statement, profile:profiles(id, full_name, avatar, grade)").eq("election_id", id),
    supabase.rpc("election_summary", { p_election: id }),
  ]);
  if (!e) notFound();
  const s = (summary as Summary | null) ?? { turnout: 0, voted: false, results: null };
  const now = new Date().toISOString();
  const state = e.opens_at > now ? "upcoming" : e.closes_at > now ? "open" : "closed";
  const eligible = me.isStudent && (!e.eligible_grades || (me.grade !== null && e.eligible_grades.includes(me.grade)));
  const votes = new Map((s.results ?? []).map((r) => [r.candidate_id, r.votes]));
  const list = [...(candidates ?? [])].sort((a, b) => (votes.get(b.id) ?? 0) - (votes.get(a.id) ?? 0));
  const topVotes = Math.max(0, ...list.map((c) => votes.get(c.id) ?? 0));

  return (
    <div className="space-y-4">
      <PageHeader title={e.title} back="/council" />
      <div className="card space-y-1 p-4 text-sm">
        {e.description && <p className="whitespace-pre-wrap">{e.description}</p>}
        <p className="text-black/55">
          Voting {formatDateTime(e.opens_at)} → {formatDateTime(e.closes_at)}
          {e.eligible_grades ? ` · grade ${e.eligible_grades.join(", ")} only` : " · all grades"}
        </p>
        <p className="text-black/55">{s.turnout} {s.turnout === 1 ? "student has" : "students have"} voted</p>
      </div>

      <section className="space-y-2">
        <h2 className="section-title">Candidates</h2>
        {list.length === 0 && <p className="text-sm text-black/50">No candidates yet.</p>}
        {list.map((c) => {
          const n = votes.get(c.id) ?? 0;
          const pct = s.turnout ? Math.round((n / s.turnout) * 100) : 0;
          const winner = state === "closed" && topVotes > 0 && n === topVotes;
          return c.profile && (
            <article key={c.id} className={`card space-y-2 p-4 ${winner ? "ring-2 ring-brand-600" : ""}`}>
              <Link href={`/profile/${c.profile.id}`} className="flex items-center gap-3">
                <Avatar avatar={c.profile.avatar} />
                <div className="flex-1">
                  <p className="font-semibold">{c.profile.full_name} {winner && "🏆"}</p>
                  <p className="text-xs text-black/50">Grade {c.profile.grade}</p>
                </div>
              </Link>
              {c.statement && <p className="text-sm text-black/75">“{c.statement}”</p>}
              {state === "closed" && (
                <div>
                  <div className="flex justify-between text-xs"><span>{winner ? "Elected" : ""}</span><span className="tabular-nums">{pct}% ({n})</span></div>
                  <div className="mt-1 h-2.5 rounded-full bg-black/[0.06]"><div className="h-2.5 rounded-full bg-brand-600" style={{ width: `${Math.max(1, pct)}%` }} /></div>
                </div>
              )}
              {c.profile.id === me.id && state !== "closed" && (
                <ActionForm action={updateStatement} className="space-y-1">
                  <input type="hidden" name="id" value={c.id} />
                  <textarea name="statement" rows={2} maxLength={500} defaultValue={c.statement} placeholder="Your message to voters" className="input resize-none text-sm" />
                  <SubmitButton className="btn-secondary px-3 py-1.5 text-xs">Save my statement</SubmitButton>
                </ActionForm>
              )}
              {me.isAdmin && state === "upcoming" && (
                <ActionForm action={removeCandidate}>
                  <input type="hidden" name="id" value={c.id} />
                  <SubmitButton className="text-xs text-black/40 hover:text-red-600" pendingText="…">Remove candidate</SubmitButton>
                </ActionForm>
              )}
            </article>
          );
        })}
      </section>

      {state === "open" && (
        s.voted ? <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">✅ You voted. Results appear when voting closes.</p>
        : eligible && !me.isSuspended ? <Ballot electionId={e.id} candidates={list.filter((c) => c.profile).map((c) => ({ id: c.id, name: c.profile!.full_name }))} />
        : <p className="text-sm text-black/50">This election is for {e.eligible_grades ? `grade ${e.eligible_grades.join(", ")}` : "current students"}.</p>
      )}
      {state === "upcoming" && <p className="text-sm text-black/50">Voting hasn&apos;t opened yet.</p>}

      {me.isAdmin && (
        <section className="space-y-3">
          {state === "upcoming" && (
            <details className="card p-4" open={list.length === 0}>
              <summary className="cursor-pointer font-semibold">Add a candidate</summary>
              <ActionForm action={addCandidate} className="mt-3 space-y-2">
                <input type="hidden" name="electionId" value={e.id} />
                <StudentPicker />
                <textarea name="statement" rows={2} maxLength={500} placeholder="Their statement (they can edit it later)" className="input resize-none" />
                <SubmitButton className="btn-primary w-full">Add candidate</SubmitButton>
              </ActionForm>
            </details>
          )}
          <form action={deleteElection}>
            <input type="hidden" name="id" value={e.id} />
            <SubmitButton className="btn-ghost w-full text-sm text-red-600" pendingText="…">Delete this election</SubmitButton>
          </form>
        </section>
      )}
    </div>
  );
}

export default function ElectionPage(props: PageProps<"/council/elections/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Election params={props.params} />
    </Suspense>
  );
}
