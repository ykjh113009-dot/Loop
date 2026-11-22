import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import { TUTOR_SUBJECTS, formatLabel } from "@/lib/tutor";
import { getT } from "@/lib/i18n-server";
import { signImages } from "@/lib/images";
import { closeStudyBuddy, finishTutoring, respondTutoring } from "@/app/actions/tutoring";
import { startChat } from "@/app/actions/messages";
import { Search, Star, Lightbulb, UserPlus } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { Empty } from "@/components/empty";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionTabs } from "@/components/ui/section-tabs";
import { BooksScene } from "@/components/art/scenes";
import { PageSkeleton } from "@/components/skeleton";
import { SubmitButton } from "@/components/submit-button";
import { StudyBuddyForm, ReviewForm } from "./forms";
import { Glyph } from "@/components/glyph";

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
      .not("approved_at", "is", null),
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
  const { data: statRows } = tutors.length ? await supabase.rpc("tutor_stats", { p_tutors: tutors.map((x) => x.profile_id) }) : { data: [] };
  const stats = new Map((statRows ?? []).map((r) => [r.tutor_id, r]));
  const bandText = mine?.approved_at
    ? <><p className="text-lg font-semibold">{t("You are an approved tutor.")}</p><p className="text-sm text-ink-2">{!mine.active ? t("Your profile is paused.") : t("Keep your profile up to date.")}</p></>
    : app && app.status !== "approved"
      ? <><p className="text-lg font-semibold">{t("Your tutor application")}</p><p className="text-sm text-ink-2">{STATUS_TEXT[app.status]}</p></>
      : <><p className="text-lg font-semibold">{t("Want to become a tutor?")}</p><p className="text-sm text-ink-2">{t("Share your knowledge and help other students!")}</p></>;
  const bandAction = mine?.approved_at
    ? { href: "/tutors/me", label: t("My tutor profile") }
    : app && app.status !== "approved"
      ? { href: "/tutors/apply", label: app.status === "pending" ? t("See my application") : t("Continue") }
      : { href: "/tutors/apply", label: t("Apply Now") };
  return (
    <div className="space-y-4">
      <form action="/tutors" role="search" className="flex flex-wrap gap-2">
        {format && <input type="hidden" name="format" value={format} />}
        <span className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-ink-2" aria-hidden="true" />
          <input name="q" defaultValue={q} className="input !rounded-full !ps-11" placeholder={t("Search for a tutor…")} aria-label={t("Search tutors")} />
        </span>
        <select name="subject" defaultValue={subject} aria-label={t("Subject")} className="input !w-auto !rounded-full !pe-9">
          <option value="">{t("All Subjects")}</option>
          {TUTOR_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button className="btn-primary rounded-full px-6">{t("Search")}</button>
      </form>
      <div className="flex gap-1.5">
        {[["", t("Any format")], ["online", t("Online")], ["in_person", t("In person")]].map(([id, label]) => (
          <Link key={id} href={link({ format: id })} className={`chip px-3.5 py-1.5 ${format === id ? "bg-brand-700 text-white" : "bg-white/80"}`}>{label}</Link>
        ))}
      </div>
      {tutors.length === 0 ? (
        <EmptyState scene="books" title={t("No approved tutors available yet.")} action={{ href: "/tutors/apply", label: t("Become a Tutor") }}>{t("Find students who can help you learn, or share your own knowledge.")}</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {tutors.map((x) => {
            const st = stats.get(x.profile_id);
            const photo = x.photo_path ? photos.get(x.photo_path) : null;
            return (
              <article key={x.profile_id} className="flex gap-4 rounded-3xl border border-brand-700/10 bg-white/85 p-4 shadow-[0_1px_2px_rgba(40,60,40,0.04)]" data-tutor={x.profile_id}>
                <Link href={`/tutors/${x.profile_id}`} className="shrink-0" aria-label={x.profile!.full_name}>
                  {photo
                    // eslint-disable-next-line @next/next/no-img-element -- private signed link
                    ? <img src={photo} alt="" className="h-36 w-28 rounded-2xl object-cover sm:h-44 sm:w-32" />
                    : <span className="flex h-36 w-28 items-center justify-center rounded-2xl bg-sage-soft sm:h-44 sm:w-32"><Avatar avatar={x.profile!.avatar} size="xl" /></span>}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <p className="flex items-start gap-2">
                    <span className="min-w-0 flex-1 truncate text-[17px] leading-tight font-semibold">{x.profile!.full_name}{x.profile_id === meId && <span className="chip ms-2 bg-brand-700 text-white">{t("You")}</span>}</span>
                    <span className="chip shrink-0 bg-sage-soft/70 text-brand-800">{t(formatLabel(x.format))}</span>
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-2">{x.subjects.slice(0, 4).join(" • ")}</p>
                  <p className="mt-1.5 flex items-center gap-1.5 text-sm" data-tutor-rating>
                    {st && Number(st.reviews) > 0
                      ? <><Star className="size-4 fill-amber-400 text-amber-500" aria-hidden="true" /><strong>{Number(st.rating_avg).toFixed(1)}</strong><span className="text-ink-2">({st.reviews} {Number(st.reviews) === 1 ? t("review") : t("reviews")})</span></>
                      : <span className="text-ink-2">{t("No reviews yet")}</span>}
                  </p>
                  {st && Number(st.sessions) > 0 && <p className="text-xs text-ink-2">{st.sessions} {Number(st.sessions) === 1 ? t("session") : t("sessions")}</p>}
                  <div className="mt-auto flex flex-wrap gap-2 pt-3">
                    <Link href={`/tutors/${x.profile_id}`} className="btn-secondary rounded-full px-4 py-2 text-sm">{t("View Profile")}</Link>
                    {x.profile_id === meId
                      ? <Link href="/tutors/me" className="btn-primary rounded-full px-4 py-2 text-sm">{t("Edit my profile")}</Link>
                      : <Link href={`/tutors/${x.profile_id}#request`} className="btn-primary rounded-full px-4 py-2 text-sm">{t("Request Session")} →</Link>}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <section className="flex flex-wrap items-center gap-4 rounded-3xl bg-[#e9ead6] p-5" data-tutor-band>
        <Lightbulb className="size-10 shrink-0 text-brand-700" strokeWidth={1.5} aria-hidden="true" />
        <div className="min-w-0 flex-1">{bandText}</div>
        <Link href={bandAction.href} className="btn-primary rounded-full px-6 py-2.5">{bandAction.label} →</Link>
      </section>
      {reviewer && <Link href="/tutors/review" className="block rounded-2xl border border-brand-700/10 bg-white/80 p-3 text-sm font-medium text-brand-700 hover:underline">{t("Review tutor applications")}</Link>}
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
              <SubmitButton className="btn-secondary px-3 py-1.5 text-xs" pendingText="Opening…"><Glyph e="💬" /> Message</SubmitButton>
            </form>
          )}
        </article>
      ))}
    </div>
  );
}

const STATUS: Record<string, string> = {
  pending: "Waiting for an answer",
  accepted: "Accepted — plan a time in your chat",
  declined: "Declined",
  completed: "Done",
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
  const { data: reviewed } = outgoing.length ? await supabase.from("tutor_reviews").select("request_id").eq("reviewer_id", meId).in("request_id", outgoing.map((r) => r.id)) : { data: [] };
  const done = new Set((reviewed ?? []).map((r) => r.request_id));

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
            {r.status === "completed" && !done.has(r.id) && <ReviewForm requestId={r.id} />}
            {r.status === "completed" && done.has(r.id) && <p className="text-xs font-medium text-brand-700"><Glyph e="✓" /> You reviewed this session</p>}
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
  if (!me.isStudent) redirect("/learning-hub");
  const sp = await searchParams;
  const tab = TABS.some((t) => t.id === sp.tab) ? (sp.tab as string) : "find";
  if (sp.tab === "me") redirect("/tutors/me");
  const subject = typeof sp.subject === "string" && TUTOR_SUBJECTS.includes(sp.subject) ? sp.subject : "";
  const format = sp.format === "online" || sp.format === "in_person" ? sp.format : "";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 50) : "";
  const canAct = !me.isSuspended;
  const { t } = await getT();
  const { data: myTutor } = await (await createClient()).from("tutor_profiles").select("approved_at").eq("profile_id", me.id).maybeSingle();
  const tabHref = (id: string) => `/tutors${id === "find" ? "" : `?tab=${id}`}`;
  return (
    <div className="space-y-5" data-tutors-page data-wide>
      <section className="relative isolate overflow-hidden rounded-3xl bg-[#e9ead6] px-5 py-6 lg:px-8 lg:py-8" data-banner>
        <div className="pointer-events-none absolute -end-10 -top-16 -z-10 size-64 rounded-full bg-[#dbe5cc]" aria-hidden="true" />
        <BooksScene className="pointer-events-none absolute end-4 bottom-0 -z-10 hidden h-full w-auto sm:block" />
        <h1 className="font-heading text-[34px] leading-none font-semibold text-brand-900 lg:text-[48px]" data-banner-title>{t("Tutors")}</h1>
        <p className="mt-2 max-w-[28rem] text-[13px] text-ink-2 lg:mt-3 lg:text-base">{t("Get help from experienced tutors in your subjects!")}</p>
        {!myTutor?.approved_at && <Link href="/tutors/apply" className="btn-primary mt-4 inline-flex items-center gap-2 rounded-full px-5 py-2.5"><UserPlus className="size-4" aria-hidden="true" />{t("Become a Tutor")}</Link>}
      </section>
      <SectionTabs label={t("Tutors Directory")} current={tabHref(tab)} items={TABS.map((x) => ({ href: tabHref(x.id), label: t(x.label) }))} />
      {tab === "find" && <Find subject={subject} format={format} q={q} meId={me.id} />}
      {tab === "buddies" && <Buddies meId={me.id} canAct={canAct} />}
      {tab === "requests" && <Requests meId={me.id} />}
    </div>
  );
}

export default function TutorsPage(props: PageProps<"/tutors">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Tutors searchParams={props.searchParams} />
    </Suspense>
  );
}
