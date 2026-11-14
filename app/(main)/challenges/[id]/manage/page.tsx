import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { signProof } from "@/lib/images";
import { challengePhase, ENTRY_STATUS } from "@/lib/challenges";
import { formatDateTime, timeAgo } from "@/lib/time";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { CancelForm, EntryDecision, QuickButton, RankForm } from "../../forms";

export const metadata = { title: "Manage challenge" };

const ACTIONS: Record<string, string> = {
  submit: "sent", withdraw: "took back", approve: "approved", reject: "rejected", override_approve: "changed to approved",
  override_reject: "changed to rejected", cancel: "cancelled", claim: "started checking", rank: "chose the winners",
};

async function Manage({ params }: { params: PageProps<"/challenges/[id]/manage">["params"] }) {
  const { id } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data: c } = await supabase.from("challenges").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const { data: canReview } = await supabase.rpc("can_review_challenge", { p_challenge: id });
  if (!canReview) redirect(`/challenges/${id}`);

  const [{ data: govern }, { data: stats }, { data: entries }, { data: people }, { data: history }, { data: prizes }] = await Promise.all([
    supabase.rpc("can_govern_challenges"),
    supabase.rpc("challenge_stats", { p_challenge: id }),
    supabase.from("challenge_submissions")
      .select("id, status, note, image_path, video_path, answers, review_note, points_awarded, placement, attempt, overridden, created_at, reviewed_at, profile_id, student:profiles!challenge_submissions_profile_id_fkey(id, full_name, grade, section), reviewer:profiles!challenge_submissions_reviewed_by_fkey(full_name)")
      .eq("challenge_id", id).order("created_at", { ascending: false }),
    supabase.from("challenge_participants").select("joined_at, profile:profiles(id, full_name, grade, section)").eq("challenge_id", id).order("joined_at"),
    supabase.from("challenge_reviews").select("id, action, subject, note, created_at, submission_id, actor:profiles!challenge_reviews_actor_id_fkey(full_name)").eq("challenge_id", id).order("created_at", { ascending: false }).limit(40),
    supabase.from("challenge_prizes").select("place").eq("challenge_id", id),
  ]);
  const s = (stats ?? {}) as Record<string, number>;
  const all = entries ?? [];
  const waiting = all.filter((e) => e.status === "submitted" || e.status === "pending");
  const decided = all.filter((e) => e.status === "approved" || e.status === "rejected");
  const proof = await signProof(supabase, all.flatMap((e) => [e.image_path, e.video_path]));
  const phase = challengePhase(c, s.approved ?? 0);
  const ended = new Date(c.ends_at) <= new Date();
  const canRank = c.reward_mode === "ranked" && c.status === "approved" && ended && !c.ranked_at && all.some((e) => e.status === "approved");
  const who = (e: (typeof all)[number]) => `${e.student?.full_name ?? "?"}${e.student?.grade ? ` · ${e.student.grade}${e.student.section ?? ""}` : ""}`;

  const entryCard = (e: (typeof all)[number], changing: boolean) => (
    <article key={e.id} className="card space-y-2 p-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <strong>{who(e)}</strong>
        <span className={`chip ${ENTRY_STATUS[e.status].cls}`}>{t(ENTRY_STATUS[e.status].label)}</span>
        <span className="text-xs text-black/45">{t("Try {n}", { n: e.attempt })} · {timeAgo(e.created_at)}</span>
        {e.overridden && <span className="chip bg-amber-50 text-amber-800">{t("Decision changed")}</span>}
        {!!e.points_awarded && <strong className="ms-auto text-brand-800">{t("+{n} points", { n: e.points_awarded })}</strong>}
      </div>
      {e.note && <p className="whitespace-pre-wrap text-black/75">{e.note}</p>}
      {e.answers.length > 0 && <ol className="list-decimal ps-5">{e.answers.map((a, i) => <li key={i}><span className="text-black/45">{c.questions[i]}</span> {a}</li>)}</ol>}
      {e.image_path && proof.get(e.image_path) && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={proof.get(e.image_path)!} alt="" loading="lazy" className="max-h-72 rounded-xl object-cover" />
      )}
      {e.video_path && proof.get(e.video_path) && <video src={proof.get(e.video_path)!} controls preload="metadata" className="max-h-72 w-full rounded-xl" />}
      {e.review_note && <p className="rounded-xl bg-black/[0.04] p-2.5 text-xs"><strong>{e.reviewer?.full_name}:</strong> {e.review_note}</p>}
      {e.profile_id === me.id ? (
        <p className="text-xs text-black/50">{t("You cannot check your own entry.")}</p>
      ) : changing ? (
        govern && <details><summary className="cursor-pointer text-xs text-brand-700 underline">{t("Change this decision")}</summary><div className="mt-2"><EntryDecision id={e.id} locale={locale} changing /></div></details>
      ) : (
        <div className="space-y-2">
          {e.status === "submitted" && <QuickButton action="claimEntry" id={e.id} label={t("Start checking")} locale={locale} />}
          <EntryDecision id={e.id} locale={locale} />
        </div>
      )}
    </article>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href={`/challenges/${id}`} className="card flex items-center gap-3 p-4 hover:bg-black/[0.02]">
        <span className="text-2xl">{c.emoji}</span>
        <div className="min-w-0 flex-1"><p className="font-bold">{c.title}</p><p className="text-xs text-black/50">{t(phase === "active" ? "Active" : phase === "completed" ? "Completed" : phase === "expired" ? "Expired" : phase === "approved" ? "Approved" : phase === "cancelled" ? "Cancelled" : phase === "pending" ? "Pending review" : phase === "rejected" ? "Rejected" : "Draft")} · {formatDateTime(c.ends_at)}</p></div>
      </Link>

      <div className="grid grid-cols-3 gap-2 text-center text-sm">
        {([["Joined", s.participants], ["To check", (s.submitted ?? 0) + (s.pending ?? 0)], ["Approved", s.approved], ["Rejected", s.rejected], ["Points paid", s.points]] as const).map(([label, n]) => (
          <div key={label} className="card p-3"><p className="text-xl font-bold">{n ?? 0}</p><p className="text-xs text-black/50">{t(label)}</p></div>
        ))}
      </div>

      {canRank && <RankForm id={c.id} places={Math.min((prizes ?? []).length, all.filter((e) => e.status === "approved").length)} locale={locale}
        entries={all.filter((e) => e.status === "approved").map((e) => ({ id: e.id, name: `${e.student?.full_name ?? "?"} (${t("Try {n}", { n: e.attempt })})` }))} />}

      <section className="space-y-2">
        <h2 className="section-title">{t("Waiting to be checked")} ({waiting.length})</h2>
        {waiting.length === 0 ? <p className="card p-4 text-sm text-black/55">{t("Nothing to check right now.")}</p> : waiting.map((e) => entryCard(e, false))}
      </section>

      {decided.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">{t("Checked")} ({decided.length})</h2>
          {decided.map((e) => entryCard(e, true))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="section-title">{t("Participants")} ({(people ?? []).length})</h2>
        <ul className="card divide-y divide-black/5 text-sm">
          {(people ?? []).length === 0 && <li className="p-4 text-black/55">{t("Nobody has joined yet.")}</li>}
          {(people ?? []).map((p) => <li key={p.profile?.id} className="flex justify-between px-4 py-2"><span>{p.profile?.full_name}</span><span className="text-xs text-black/45">{p.profile?.grade}{p.profile?.section ?? ""}</span></li>)}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="section-title">{t("History")}</h2>
        <ul className="card divide-y divide-black/5 text-xs">
          {(history ?? []).map((h) => (
            <li key={h.id} className="px-4 py-2"><strong>{h.actor?.full_name ?? t("Someone")}</strong> {t(ACTIONS[h.action] ?? h.action)} {h.subject === "idea" ? t("the challenge") : t("an entry")}
              <span className="text-black/45"> · {timeAgo(h.created_at)}</span>{h.note && <span className="block text-black/55">“{h.note}”</span>}</li>
          ))}
        </ul>
      </section>

      {(c.status === "approved" || c.status === "pending") && (c.created_by === me.id || govern) && <CancelForm id={c.id} locale={locale} />}
    </div>
  );
}

export default function ManageChallengePage(props: PageProps<"/challenges/[id]/manage">) {
  return (
    <>
      <PageHeader title="Manage challenge" back="/challenges" />
      <Suspense fallback={<PageSkeleton />}><Manage params={props.params} /></Suspense>
    </>
  );
}
