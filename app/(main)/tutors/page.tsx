import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import { SUBJECTS } from "@/lib/subjects";
import { closeStudyBuddy, finishTutoring, respondTutoring, stopTutoring } from "@/app/actions/tutoring";
import { startChat } from "@/app/actions/messages";
import { Avatar } from "@/components/avatar";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { SubmitButton } from "@/components/submit-button";
import { AskTutorForm, StudyBuddyForm, TutorProfileForm } from "./forms";

export const metadata = { title: "Tutors & study buddies" };

const TABS = [
  { id: "find", label: "Tutors" },
  { id: "buddies", label: "Study buddies" },
  { id: "requests", label: "Requests" },
  { id: "me", label: "I can help" },
];

async function Find({ subject, meId, canAct }: { subject: string; meId: string; canAct: boolean }) {
  const supabase = await createClient();
  let query = supabase
    .from("tutor_profiles")
    .select("profile_id, subjects, about, availability, profile:profiles(id, full_name, avatar, grade)")
    .eq("active", true)
    .neq("profile_id", meId);
  if (subject) query = query.contains("subjects", [subject]);
  const { data } = await query;
  const tutors = data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <Link href="/tutors" className={`chip shrink-0 ${!subject ? "bg-brand-700 text-white" : ""}`}>All</Link>
        {SUBJECTS.filter((s) => s !== "Other").map((s) => (
          <Link key={s} href={`/tutors?subject=${encodeURIComponent(s)}`} className={`chip shrink-0 ${subject === s ? "bg-brand-700 text-white" : ""}`}>{s}</Link>
        ))}
      </div>
      {tutors.length === 0 ? (
        <Empty emoji="📚" title="No tutors for this subject yet">Good at it? Tap “I can help”.</Empty>
      ) : (
        tutors.map((t) => t.profile && (
          <article key={t.profile_id} className="card space-y-2 p-4">
            <Link href={`/profile/${t.profile.id}`} className="flex items-center gap-3">
              <Avatar avatar={t.profile.avatar} />
              <div>
                <p className="font-semibold">{t.profile.full_name}</p>
                <p className="text-xs text-black/50">Grade {t.profile.grade}{t.availability && ` · ${t.availability}`}</p>
              </div>
            </Link>
            <div className="flex flex-wrap gap-1">{t.subjects.map((s) => <span key={s} className="chip bg-brand-50 text-brand-800">{s}</span>)}</div>
            {t.about && <p className="text-sm text-black/70">{t.about}</p>}
            {canAct && <AskTutorForm tutorId={t.profile.id} subjects={t.subjects} />}
          </article>
        ))
      )}
    </div>
  );
}

async function Buddies({ meId, canAct }: { meId: string; canAct: boolean }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("study_buddy_posts")
    .select("id, subject, note, created_at, author:profiles(id, full_name, avatar, grade)")
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(40);
  return (
    <div className="space-y-3">
      {canAct && <StudyBuddyForm />}
      {(data ?? []).length === 0 ? <Empty emoji="👯" title="No study buddy posts yet" /> : (data ?? []).map((p) => p.author && (
        <article key={p.id} className="card space-y-2 p-4">
          <div className="flex items-center gap-3">
            <Avatar avatar={p.author.avatar} size="sm" />
            <p className="flex-1 text-sm">
              <Link href={`/profile/${p.author.id}`} className="font-semibold">{p.author.full_name}</Link>
              <span className="text-black/45"> · Grade {p.author.grade} · {timeAgo(p.created_at)}</span>
            </p>
            <span className="chip bg-brand-50 text-brand-800">{p.subject}</span>
          </div>
          <p className="text-sm">{p.note}</p>
          {p.author.id === meId ? (
            <form action={closeStudyBuddy}>
              <input type="hidden" name="id" value={p.id} />
              <SubmitButton className="text-xs text-black/45 hover:text-red-600" pendingText="…">Remove my post</SubmitButton>
            </form>
          ) : canAct && (
            <form action={startChat}>
              <input type="hidden" name="profileId" value={p.author.id} />
              <SubmitButton className="btn-secondary px-3 py-1.5 text-xs" pendingText="Opening…">💬 Message</SubmitButton>
            </form>
          )}
        </article>
      ))}
    </div>
  );
}

const STATUS: Record<string, string> = {
  pending: "⏳ Waiting for an answer",
  accepted: "✅ Accepted — plan a time in your chat",
  declined: "Declined",
  completed: "🎉 Done",
  cancelled: "Cancelled",
};

async function Requests({ meId }: { meId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("tutoring_requests")
    .select("id, subject, message, status, created_at, learner_id, tutor_id, learner:profiles!tutoring_requests_learner_id_fkey(id, full_name, avatar, grade), tutor:profiles!tutoring_requests_tutor_id_fkey(id, full_name, avatar, grade)")
    .order("created_at", { ascending: false })
    .limit(50);
  const incoming = (data ?? []).filter((r) => r.tutor_id === meId);
  const outgoing = (data ?? []).filter((r) => r.learner_id === meId);

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h2 className="section-title">People asking me for help</h2>
        {incoming.length === 0 ? <p className="text-sm text-black/50">None yet.</p> : incoming.map((r) => (
          <article key={r.id} className="card space-y-2 p-4 text-sm">
            <p><strong>{r.learner?.full_name}</strong> <span className="text-black/45">(grade {r.learner?.grade}) · {r.subject} · {timeAgo(r.created_at)}</span></p>
            {r.message && <p className="text-black/70">“{r.message}”</p>}
            {r.status === "pending" ? (
              <div className="flex gap-2">
                <form action={respondTutoring}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="accept" value="true" />
                  <SubmitButton className="btn-primary px-3 py-2" pendingText="…">Accept & chat</SubmitButton>
                </form>
                <form action={respondTutoring}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="accept" value="false" />
                  <SubmitButton className="btn-secondary px-3 py-2" pendingText="…">Not now</SubmitButton>
                </form>
              </div>
            ) : <p className="text-xs text-black/55">{STATUS[r.status]}</p>}
          </article>
        ))}
      </section>
      <section className="space-y-2">
        <h2 className="section-title">My requests</h2>
        {outgoing.length === 0 ? <p className="text-sm text-black/50">You haven&apos;t asked anyone yet.</p> : outgoing.map((r) => (
          <article key={r.id} className="card space-y-2 p-4 text-sm">
            <p><strong>{r.subject}</strong> <span className="text-black/45">with {r.tutor?.full_name} · {timeAgo(r.created_at)}</span></p>
            <p className="text-xs text-black/55">{STATUS[r.status]}</p>
            {(r.status === "accepted" || r.status === "pending") && (
              <div className="flex gap-2">
                {r.status === "accepted" && (
                  <form action={finishTutoring}>
                    <input type="hidden" name="id" value={r.id} />
                    <input type="hidden" name="done" value="true" />
                    <SubmitButton className="btn-primary px-3 py-2" pendingText="…">We met — it helped!</SubmitButton>
                  </form>
                )}
                <form action={finishTutoring}>
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="done" value="false" />
                  <SubmitButton className="btn-secondary px-3 py-2" pendingText="…">Cancel</SubmitButton>
                </form>
              </div>
            )}
          </article>
        ))}
      </section>
    </div>
  );
}

async function Me({ meId }: { meId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("tutor_profiles").select("subjects, about, availability, active").eq("profile_id", meId).maybeSingle();
  return (
    <div className="space-y-3">
      <TutorProfileForm current={data} />
      {data && (
        <form action={stopTutoring}>
          <SubmitButton className="btn-ghost w-full text-sm text-black/50" pendingText="…">Stop being a tutor</SubmitButton>
        </form>
      )}
    </div>
  );
}

async function Tutors({ searchParams }: { searchParams: PageProps<"/tutors">["searchParams"] }) {
  const me = await requireMe();
  if (!me.isStudent) redirect("/tawjihi");
  const sp = await searchParams;
  const tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as string) : "find";
  const subject = typeof sp.subject === "string" && SUBJECTS.includes(sp.subject) ? sp.subject : "";
  const canAct = !me.isSuspended;
  return (
    <>
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-xl bg-black/5 p-1">
        {TABS.map((t) => (
          <Link key={t.id} href={`/tutors?tab=${t.id}`} className={`shrink-0 flex-1 rounded-lg px-2 py-1.5 text-center text-sm font-medium ${tab === t.id ? "bg-white shadow-sm" : "text-black/55"}`}>
            {t.label}
          </Link>
        ))}
      </div>
      {tab === "find" && <Find subject={subject} meId={me.id} canAct={canAct} />}
      {tab === "buddies" && <Buddies meId={me.id} canAct={canAct} />}
      {tab === "requests" && <Requests meId={me.id} />}
      {tab === "me" && <Me meId={me.id} />}
    </>
  );
}

export default function TutorsPage(props: PageProps<"/tutors">) {
  return (
    <>
      <PageHeader title="Tutors & study buddies" back="/more" />
      <Suspense fallback={<PageSkeleton />}>
        <Tutors searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
