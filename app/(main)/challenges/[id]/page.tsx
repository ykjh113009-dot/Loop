import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { signImages, signProof } from "@/lib/images";
import { categoryOf, challengePhase, ENTRY_STATUS, kindOf, PHASE, PROOF } from "@/lib/challenges";
import { formatDateTime, formatShortDate } from "@/lib/time";
import { deleteChallengeDraft } from "@/app/actions/challenges";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { ReportButton } from "@/components/report-button";
import { SubmitButton } from "@/components/submit-button";
import { EntryForm } from "../entry-form";
import { JoinButton, QuickButton } from "../forms";
import { Glyph, Place } from "@/components/glyph";

export const metadata = { title: "Challenge" };

async function Challenge({ params }: { params: PageProps<"/challenges/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data: c } = await supabase.from("challenges").select("*, creator:profiles!challenges_created_by_fkey(id, full_name)").eq("id", id).maybeSingle();
  if (!c) notFound();

  const [{ data: prizes }, { data: counts }, { data: joined }, { data: entries }, { data: canReview }, { data: winners }] = await Promise.all([
    supabase.from("challenge_prizes").select("place, points").eq("challenge_id", id).order("place"),
    supabase.rpc("challenge_counts", { p_ids: [id] }),
    supabase.from("challenge_participants").select("profile_id").eq("challenge_id", id).eq("profile_id", me.id),
    supabase.from("challenge_submissions").select("id, status, note, image_path, video_path, answers, review_note, points_awarded, placement, attempt, created_at, reviewed_at").eq("challenge_id", id).eq("profile_id", me.id).order("attempt"),
    supabase.rpc("can_review_challenge", { p_challenge: id }),
    c.ranked_at ? supabase.from("challenge_submissions").select("placement, points_awarded, student:profiles!challenge_submissions_profile_id_fkey(full_name)").eq("challenge_id", id).not("placement", "is", null).order("placement") : Promise.resolve({ data: [] }),
  ]);
  const count = counts?.[0];
  const phase = challengePhase(c, count?.approved ?? 0);
  const mine = c.created_by === me.id;
  const hasJoined = (joined ?? []).length > 0;
  const myEntries = entries ?? [];
  const open = myEntries.some((e) => e.status === "submitted" || e.status === "pending");
  const live = myEntries.filter((e) => e.status !== "rejected").length;
  const attemptsLeft = c.attempts_per_student - live;
  const full = c.max_participants !== null && (count?.participants ?? 0) >= c.max_participants;
  const cat = categoryOf(c.category);
  const [covers, proof] = await Promise.all([
    signImages(supabase, [c.cover_path]),
    signProof(supabase, myEntries.flatMap((e) => [e.image_path, e.video_path])),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <article className="card overflow-hidden">
        {c.cover_path && covers.get(c.cover_path) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={covers.get(c.cover_path)!} alt="" className="h-44 w-full object-cover" />
        )}
        <div className="space-y-3 p-4">
          <div className="flex items-start gap-3">
            <span className="text-3xl"><Glyph e={c.emoji} /></span>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold">{c.title}</h2>
              <p className="text-xs text-black/50"><Glyph e={cat.emoji} /> {t(cat.label)} · {t(kindOf(c.kind).label)} · {t("by {name}", { name: c.creator?.full_name ?? t("a former student") })}</p>
            </div>
            <span className={`chip shrink-0 ${PHASE[phase].cls}`}>{t(PHASE[phase].label)}</span>
          </div>
          {c.description && <p className="text-sm whitespace-pre-wrap text-black/80">{c.description}</p>}
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-xl bg-brand-50 p-3"><dt className="text-xs text-black/50">{t("Reward")}</dt><dd className="font-bold text-brand-800">
              {c.reward_mode === "ranked" ? t("By place") : t("+{n} points", { n: c.points })}
            </dd></div>
            <div className="rounded-xl bg-black/[0.04] p-3"><dt className="text-xs text-black/50">{t("Deadline")}</dt><dd className="font-semibold">{formatDateTime(new Date(new Date(c.ends_at).getTime() - 1))}</dd></div>
            <div className="rounded-xl bg-black/[0.04] p-3"><dt className="text-xs text-black/50">{t("Joined")}</dt><dd className="font-semibold">{c.max_participants ? t("{a} of {b}", { a: count?.participants ?? 0, b: c.max_participants }) : (count?.participants ?? 0)}</dd></div>
            <div className="rounded-xl bg-black/[0.04] p-3"><dt className="text-xs text-black/50">{t("Tries")}</dt><dd className="font-semibold">
              {c.attempts_per_student === 1 ? t("One time") : t("Up to {n} (first {m} rewarded)", { n: c.attempts_per_student, m: c.rewards_per_student })}
            </dd></div>
          </dl>
          {c.reward_mode === "ranked" && (
            <ul className="space-y-1 text-sm">
              {(prizes ?? []).map((p) => <li key={p.place}><Place n={p.place} /> {t("+{n} points", { n: p.points })}</li>)}
              {c.points > 0 && <li className="text-black/55">{t("Everyone approved also gets +{n} points", { n: c.points })}</li>}
            </ul>
          )}
          {c.audience !== "school" && <p className="text-xs text-black/55"><Glyph e="👥" /> {c.audience === "grade" ? t("For grade {g}", { g: c.audience_grade ?? "" }) : t("For class {g}{s}", { g: c.audience_grade ?? "", s: c.audience_section ?? "" })}</p>}
        </div>
      </article>

      {(c.instructions || c.rules) && (
        <section className="card space-y-3 p-4 text-sm">
          {c.instructions && <div><h3 className="font-bold">{t("What to do")}</h3><p className="mt-1 whitespace-pre-wrap text-black/75">{c.instructions}</p></div>}
          {c.rules && <div><h3 className="font-bold">{t("Rules")}</h3><p className="mt-1 whitespace-pre-wrap text-black/75">{c.rules}</p></div>}
        </section>
      )}

      <section className="card p-4 text-sm">
        <h3 className="font-bold">{t("What you need to send")}</h3>
        <ul className="mt-1 space-y-0.5">
          {PROOF.filter((p) => c.proof_kinds.includes(p.id)).map((p) => <li key={p.id}><Glyph e={p.emoji} /> {t(p.label)}</li>)}
        </ul>
        {c.proof_kinds.includes("answers") && (
          <ol className="mt-2 list-decimal ps-5 text-black/70">{c.questions.map((q, i) => <li key={i}>{q}</li>)}</ol>
        )}
      </section>

      {/* The creator's own view while the idea is being reviewed */}
      {mine && c.status !== "approved" && (
        <section className={`card space-y-3 p-4 text-sm ${c.status === "rejected" ? "border-red-200" : ""}`}>
          <p className="font-bold">
            {c.status === "draft" && t("This is a draft. Only you can see it.")}
            {c.status === "pending" && t("Waiting for the Student Council or an admin. You will get a notification.")}
            {c.status === "rejected" && t("It needs changes before it can be approved.")}
            {c.status === "cancelled" && t("This challenge was cancelled.")}
          </p>
          {c.review_note && <p className="rounded-xl bg-black/[0.04] p-3">{c.review_note}</p>}
          <div className="flex flex-wrap gap-2">
            {(c.status === "draft" || c.status === "rejected") && <Link href={`/challenges/${c.id}/edit`} className="btn-primary">{t("Edit and send")}</Link>}
            {c.status === "pending" && <QuickButton action="withdrawChallenge" id={c.id} label={t("Take it back to edit")} locale={locale} />}
            {(c.status === "draft" || c.status === "rejected") && (
              <form action={deleteChallengeDraft}><input type="hidden" name="id" value={c.id} /><SubmitButton className="btn-ghost text-red-700" pendingText="…">{t("Delete")}</SubmitButton></form>
            )}
          </div>
        </section>
      )}

      {/* Taking part */}
      {c.status === "approved" && !mine && me.isStudent && !me.isSuspended && (
        <section className="card space-y-3 p-4">
          {phase === "approved" && <p className="text-sm text-black/60">{t("This challenge starts on {d}.", { d: formatShortDate(c.starts_at) })}</p>}
          {phase === "active" && !hasJoined && (full ? <p className="text-sm font-semibold">{t("This challenge is full.")}</p> : <JoinButton id={c.id} locale={locale} />)}
          {phase === "active" && hasJoined && !open && attemptsLeft > 0 && (
            <>
              <h3 className="font-bold">{myEntries.length ? t("Try again") : t("Send your proof")}</h3>
              <EntryForm challengeId={c.id} proofKinds={c.proof_kinds} questions={c.questions} locale={locale} ids={{ schoolId: me.school_id, challengeId: c.id, userId: me.id }} />
            </>
          )}
          {phase === "active" && hasJoined && open && <p className="text-sm text-black/65">{t("Your entry is being checked. You will get a notification.")}</p>}
          {phase === "active" && hasJoined && !open && attemptsLeft <= 0 && <p className="text-sm text-black/65">{t("You have used all your tries for this challenge.")}</p>}
          {(phase === "completed" || phase === "expired") && <p className="text-sm text-black/60">{t("This challenge has ended.")}</p>}
        </section>
      )}

      {myEntries.length > 0 && (
        <section className="space-y-2">
          <h3 className="section-title">{t("My entries")}</h3>
          {myEntries.map((e) => (
            <article key={e.id} className="card space-y-2 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`chip ${ENTRY_STATUS[e.status].cls}`}>{t(ENTRY_STATUS[e.status].label)}</span>
                <span className="text-xs text-black/45">{t("Try {n}", { n: e.attempt })} · {formatShortDate(e.created_at)}</span>
                {!!e.points_awarded && <strong className="ms-auto text-brand-800">{t("+{n} points", { n: e.points_awarded })}</strong>}
                {e.placement && <span className="chip bg-amber-50 text-amber-800">{t("Place {n}", { n: e.placement })}</span>}
              </div>
              {e.note && <p className="whitespace-pre-wrap text-black/75">{e.note}</p>}
              {e.answers.length > 0 && <ol className="list-decimal ps-5 text-black/75">{e.answers.map((a, i) => <li key={i}><span className="text-black/45">{c.questions[i]}</span> {a}</li>)}</ol>}
              {e.image_path && proof.get(e.image_path) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={proof.get(e.image_path)!} alt="" loading="lazy" className="max-h-56 rounded-xl object-cover" />
              )}
              {e.video_path && proof.get(e.video_path) && <video src={proof.get(e.video_path)!} controls preload="metadata" className="max-h-56 w-full rounded-xl" />}
              {e.status === "rejected" && e.review_note && <p className="rounded-xl bg-red-50 p-3 text-red-800"><strong>{t("Feedback")}:</strong> {e.review_note}</p>}
              {e.status === "approved" && e.review_note && <p className="rounded-xl bg-brand-50 p-3 text-brand-900">{e.review_note}</p>}
              {e.status === "submitted" && <QuickButton action="withdrawEntry" id={e.id} label={t("Take back")} className="text-xs text-black/45 hover:text-red-600" locale={locale} />}
            </article>
          ))}
        </section>
      )}

      {(winners ?? []).length > 0 && (
        <section className="card p-4 text-sm">
          <h3 className="font-bold">{t("Winners")}</h3>
          <ol className="mt-1 space-y-1">
            {(winners ?? []).map((w) => <li key={w.placement}>{w.placement ? <Place n={w.placement} /> : null} {w.student?.full_name}</li>)}
          </ol>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        {canReview ? <Link href={`/challenges/${c.id}/manage`} className="btn-secondary">{t("Manage and check entries")}</Link> : <span />}
        {!mine && c.status === "approved" && <ReportButton targetType="challenge" targetId={c.id} />}
      </div>
    </div>
  );
}

export default function ChallengePage(props: PageProps<"/challenges/[id]">) {
  return (
    <>
      <PageHeader title="Challenge" back="/challenges" />
      <Suspense fallback={<PageSkeleton />}><Challenge params={props.params} /></Suspense>
    </>
  );
}
