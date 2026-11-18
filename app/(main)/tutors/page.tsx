import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import { TUTOR_SUBJECTS, DAYS, formatLabel } from "@/lib/tutor";
import { getT } from "@/lib/i18n-server";
import { signImages } from "@/lib/images";
import { closeStudyBuddy, finishTutoring, respondTutoring } from "@/app/actions/tutoring";
import { startChat } from "@/app/actions/messages";
import { Avatar } from "@/components/avatar";
import { Empty } from "@/components/empty";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { SubmitButton } from "@/components/submit-button";
import { StudyBuddyForm } from "./forms";

export const metadata = { title: "Tutors Directory" };

const TABS = [
  { id: "find", label: "Directory" },
  { id: "buddies", label: "Study buddies" },
  { id: "requests", label: "Requests" },
];

async function Find({ subject, format, q, meId }: { subject: string; format: string; q: string; meId: string }) {
  const supabase = await createClient();
  const { t } = await getT();
  const [{ data }, { data: mine }, { data: app }, { data: reviewer }] = await Promise.all([
    supabase
      .from("tutor_profiles")
      .select("profile_id, subjects, about, qualifications, availability, format, days, hours, photo_path, profile:profiles(id, full_name, avatar, grade)")
      .eq("active", true)
      .not("approved_at", "is", null)
      .neq("profile_id", meId),
    supabase.from("tutor_profiles").select("profile_id, active, approved_at").eq("profile_id", meId).maybeSingle(),
    supabase.from("tutor_applications").select("status, review_note").eq("profile_id", meId).maybeSingle(),
    supabase.rpc("can_review_tutors"),
  ]);
  const all = (data ?? []).filter((x) => x.profile);
  const needle = q.toLowerCase();
  const tutors = all.filter((x) =>
    (!subject || x.subjects.includes(subject)) && (!format || x.format === format || x.format === "both") &&
    (!needle || x.profile!.full_name.toLowerCase().includes(needle) || x.about.toLowerCase().includes(needle) || x.subjects.some((s) => s.toLowerCase().includes(needle))));
  const photos = await signImages(supabase, tutors.map((x) => x.photo_path));
  const link = (o: Record<string, string>) => `/tutors?${new URLSearchParams({ ...(subject ? { subject } : {}), ...(format ? { format } : {}), ...(q ? { q } : {}), ...o })}`;
  const STATUS_TEXT: Record<string, string> = {
    draft: t("You started a tutor application. Finish it when you are ready."),
    pending: t("Your tutor application is waiting for review."),
    rejected: t("Your tutor application needs changes."),
  };
  return (
    <div className="space-y-3">
      <div className="card flex flex-wrap items-center justify-between gap-3 p-4">
        {mine?.approved_at ? (
          <>
            <p className="text-sm">{t("You are an approved tutor.")} {!mine.active && <strong>{t("Your profile is paused.")}</strong>}</p>
            <Link href="/tutors/me" className="btn-secondary">{t("My tutor profile")}</Link>
          </>
        ) : app && app.status !== "approved" ? (
          <>
            <p className="min-w-0 flex-1 text-sm">{STATUS_TEXT[app.status]}</p>
            <Link href="/tutors/apply" className="btn-primary">{app.status === "pending" ? t("See my application") : t("Continue")}</Link>
          </>
        ) : (
          <>
            <p className="min-w-0 flex-1 text-sm text-black/65">{t("Good at a subject? Apply to become an approved tutor.")}</p>
            <Link href="/tutors/apply" className="btn-primary">{t("Become a Tutor")}</Link>
          </>
        )}
      </div>
      {reviewer && <Link href="/tutors/review" className="card block p-3 text-sm text-brand-700 underline">{t("Review tutor applications")}</Link>}
      <form action="/tutors" className="flex gap-2">
        {subject && <input type="hidden" name="subject" value={subject} />}
        {format && <input type="hidden" name="format" value={format} />}
        <input name="q" defaultValue={q} className="input" placeholder={t("Search by name or subject")} aria-label={t("Search tutors")} />
        <button className="btn-secondary shrink-0 px-3">{t("Search")}</button>
      </form>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <Link href={link({ subject: "" })} className={`chip shrink-0 ${!subject ? "bg-brand-700 text-white" : ""}`}>{t("All")}</Link>
        {TUTOR_SUBJECTS.map((s) => (
          <Link key={s} href={link({ subject: s })} className={`chip shrink-0 ${subject === s ? "bg-brand-700 text-white" : ""}`}>{s}</Link>
        ))}
      </div>
      <div className="flex gap-1.5">
        {[["", t("Any format")], ["online", t("Online")], ["in_person", t("In person")]].map(([id, label]) => (
          <Link key={id} href={link({ format: id })} className={`chip ${format === id ? "bg-brand-700 text-white" : ""}`}>{label}</Link>
        ))}
      </div>
      {tutors.length === 0 ? (
        <EmptyState scene="books" title={t("No approved tutors available yet.")} action={{ href: "/tutors/apply", label: t("Become a Tutor") }}>{t("Find students who can help you learn, or share your own knowledge.")}</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {tutors.map((x) => (
            <article key={x.profile_id} className="card flex flex-col gap-2 p-4" data-tutor={x.profile_id}>
              <div className="flex items-center gap-3">
                {x.photo_path && photos.get(x.photo_path) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photos.get(x.photo_path)!} alt="" className="size-12 rounded-full object-cover" />
                ) : <Avatar avatar={x.profile!.avatar} />}
                <div className="min-w-0">
                  <p className="truncate font-semibold">{x.profile!.full_name}</p>
                  <p className="text-xs text-black/50">{t("Grade")} {x.profile!.grade} · {t(formatLabel(x.format))}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">{x.subjects.slice(0, 5).map((s) => <span key={s} className="chip bg-brand-50 text-brand-800">{s}</span>)}{x.subjects.length > 5 && <span className="chip">+{x.subjects.length - 5}</span>}</div>
              {x.about && <p className="line-clamp-3 text-sm text-black/70">{x.about}</p>}
              {x.qualifications && <p className="line-clamp-2 text-xs text-black/55">🎓 {x.qualifications}</p>}
              <p className="text-xs text-black/55">🕒 {x.days.length ? x.days.map((d) => DAYS.find((y) => y.id === d)?.label).join(", ") + (x.hours ? ` · ${x.hours}` : "") : x.availability || t("Ask for times")}</p>
              <Link href={`/tutors/${x.profile_id}`} className="btn-secondary mt-auto w-full">{t("View profile")}</Link>
            </article>
          ))}
        </div>
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

async function Tutors({ searchParams }: { searchParams: PageProps<"/tutors">["searchParams"] }) {
  const me = await requireMe();
  if (!me.isStudent) redirect("/tawjihi");
  const sp = await searchParams;
  const tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as string) : "find";
  if (sp.tab === "me") redirect("/tutors/me");
  const subject = typeof sp.subject === "string" && TUTOR_SUBJECTS.includes(sp.subject) ? sp.subject : "";
  const format = sp.format === "online" || sp.format === "in_person" ? sp.format : "";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 50) : "";
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
      {tab === "find" && <Find subject={subject} format={format} q={q} meId={me.id} />}
      {tab === "buddies" && <Buddies meId={me.id} canAct={canAct} />}
      {tab === "requests" && <Requests meId={me.id} />}
    </>
  );
}

export default function TutorsPage(props: PageProps<"/tutors">) {
  return (
    <>
      <PageHeader title="Tutors Directory" back="/learning-hub" />
      <Suspense fallback={<PageSkeleton />}>
        <Tutors searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
