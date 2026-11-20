import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { signImages } from "@/lib/images";
import { DAYS, formatLabel } from "@/lib/tutor";
import { startChat } from "@/app/actions/messages";
import { Avatar } from "@/components/avatar";
import { ArrowLeft, Star, GraduationCap, BookOpen, CalendarDays } from "lucide-react";
import { Stars } from "@/components/ui/stars";
import { timeAgo } from "@/lib/time";
import { PageSkeleton } from "@/components/skeleton";
import { SubmitButton } from "@/components/submit-button";
import { AskTutorForm } from "../forms";
import { Glyph } from "@/components/glyph";

export const metadata = { title: "Tutor" };

async function Tutor({ params }: { params: PageProps<"/tutors/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const { t } = await getT();
  const { data: x } = await supabase
    .from("tutor_profiles")
    .select("profile_id, subjects, about, qualifications, experience, availability, format, days, hours, preferred_times, photo_path, active, approved_at, profile:profiles(id, full_name, avatar, grade)")
    .eq("profile_id", id)
    .maybeSingle();
  if (!x || !x.profile || (!x.approved_at && x.profile_id !== me.id)) notFound();
  const photos = await signImages(supabase, [x.photo_path]);
  const mine = x.profile_id === me.id;
  const canAct = me.isStudent && !me.isSuspended && !mine && x.active;
  const [{ data: statRows }, { data: reviews }] = await Promise.all([
    supabase.rpc("tutor_stats", { p_tutors: [x.profile_id] }),
    supabase.from("tutor_reviews").select("id, rating, comment, created_at, reviewer:profiles!tutor_reviews_reviewer_id_fkey(full_name, avatar)").eq("tutor_id", x.profile_id).order("created_at", { ascending: false }).limit(10),
  ]);
  const st = (statRows ?? [])[0];
  const photo = x.photo_path ? photos.get(x.photo_path) : null;
  const card = "rounded-3xl border border-brand-700/10 bg-white/85 p-5 shadow-[0_1px_2px_rgba(40,60,40,0.04)]";
  const times = [x.hours, x.preferred_times].filter(Boolean).join(" · ") || x.availability;
  return (
    <div className="mx-auto max-w-4xl space-y-4" data-tutor-profile data-wide>
      <Link href="/tutors" className="inline-flex items-center gap-2 rounded-full border border-brand-700/10 bg-white/80 px-4 py-2 text-sm font-medium hover:bg-white"><ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />{t("Back to Tutors")}</Link>
      <article className={`${card} flex flex-col gap-5 sm:flex-row`}>
        <div className="flex shrink-0 flex-col items-center gap-2 sm:w-48">
          {photo
            // eslint-disable-next-line @next/next/no-img-element -- private signed link
            ? <img src={photo} alt="" className="h-56 w-44 rounded-3xl object-cover sm:h-60 sm:w-48" />
            : <span className="flex h-56 w-44 items-center justify-center rounded-3xl bg-sage-soft sm:h-60 sm:w-48"><Avatar avatar={x.profile.avatar} size="xl" /></span>}
          {st && Number(st.reviews) > 0 && <><Stars value={Number(st.rating_avg)} className="size-5" /><p className="text-sm text-ink-2">({st.reviews} {Number(st.reviews) === 1 ? t("review") : t("reviews")})</p></>}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-[28px] leading-tight font-semibold" data-banner-title>{x.profile.full_name}</h1>
            <span className="chip bg-sage-soft/70 text-brand-800">{t(formatLabel(x.format))}</span>
            {!x.active && <span className="chip bg-amber-50 text-amber-800">{t("Paused")}</span>}
          </div>
          <p className="text-lg text-ink-2">{x.subjects.join(" • ")}</p>
          <p className="flex items-center gap-2 text-[15px]">
            {st && Number(st.reviews) > 0
              ? <><Star className="size-5 fill-amber-400 text-amber-500" aria-hidden="true" /><strong>{Number(st.rating_avg).toFixed(1)}</strong><span className="text-ink-2">({st.sessions} {Number(st.sessions) === 1 ? t("session") : t("sessions")})</span></>
              : <span className="text-ink-2">{t("No reviews yet")} · {t("Grade")} {x.profile.grade}</span>}
          </p>
          {x.about && <p className="text-[15px] leading-relaxed text-ink-2">{x.about}</p>}
          <div className="flex flex-wrap gap-2.5 pt-1">
            {canAct && <a href="#request" className="btn-primary rounded-full px-6 py-3 text-[15px]">{t("Request a Session")} →</a>}
            {canAct && (
              <form action={startChat}>
                <input type="hidden" name="profileId" value={x.profile.id} />
                <SubmitButton className="btn-secondary rounded-full px-6 py-3 text-[15px]" pendingText="…"><Glyph e="💬" /> {t("Message")}</SubmitButton>
              </form>
            )}
            {mine && <Link href="/tutors/me" className="btn-primary rounded-full px-6 py-3">{t("Edit my tutor profile")}</Link>}
          </div>
        </div>
      </article>

      <section className={`${card} grid gap-6 sm:grid-cols-2`}>
        <div>
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold"><GraduationCap className="size-5 text-brand-700" aria-hidden="true" />{t("About me")}</h2>
          <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink-2">{x.about || t("This tutor has not written an introduction yet.")}</p>
          {x.qualifications && <><h3 className="mt-4 mb-1 text-sm font-semibold">{t("Qualifications")}</h3><p className="text-sm whitespace-pre-wrap text-ink-2">{x.qualifications}</p></>}
          {x.experience && <><h3 className="mt-4 mb-1 text-sm font-semibold">{t("Experience")}</h3><p className="text-sm whitespace-pre-wrap text-ink-2">{x.experience}</p></>}
        </div>
        <div className="sm:border-s sm:border-brand-700/10 sm:ps-6">
          <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold"><BookOpen className="size-5 text-brand-700" aria-hidden="true" />{t("Subjects")}</h2>
          <ul className="space-y-1.5 text-[15px]">{x.subjects.map((sub) => <li key={sub} className="flex items-center gap-2.5"><span className="size-2.5 rounded-full bg-brand-700" aria-hidden="true" />{sub}</li>)}</ul>
        </div>
      </section>

      <section className="rounded-3xl bg-[#e9ead6] p-5" data-tutor-hours>
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold"><CalendarDays className="size-5 text-brand-700" aria-hidden="true" />{t("Available Hours")}</h2>
        <div className="flex flex-wrap gap-1.5">{DAYS.map((d) => <span key={d.id} className={`chip ${x.days.includes(d.id) ? "bg-brand-700 text-white" : "bg-white/60 text-black/35"}`}>{t(d.label)}</span>)}</div>
        <p className="mt-2 text-[15px] text-ink-2">{times || t("Ask for times")}</p>
      </section>

      {canAct && (
        <section id="request" className={`${card} scroll-mt-24 space-y-3`}>
          <h2 className="text-lg font-semibold">{t("Request a Session")}</h2>
          <p className="text-sm text-ink-2">{t("Send a request and plan a time together, or just say hello first.")}</p>
          <AskTutorForm tutorId={x.profile.id} subjects={x.subjects} />
        </section>
      )}

      <section className={card} data-tutor-reviews>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold"><Star className="size-5 text-brand-700" aria-hidden="true" />{t("Reviews")}</h2>
        {(reviews ?? []).length === 0 ? (
          <p className="rounded-2xl bg-sage-soft/40 px-4 py-5 text-center text-sm text-ink-2">{t("No reviews yet. Students can review a tutor after a finished session.")}</p>
        ) : (
          <ul className="divide-y divide-brand-700/10">
            {(reviews ?? []).map((r) => (
              <li key={r.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <Avatar avatar={r.reviewer?.avatar ?? "a01"} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center justify-between gap-2 text-sm"><span className="font-semibold">{r.reviewer?.full_name}</span><span className="text-xs text-ink-2">{timeAgo(r.created_at)}</span></p>
                  <Stars value={r.rating} />
                  {r.comment && <p className="mt-1 text-sm break-words text-ink-2">{r.comment}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function TutorPage(props: PageProps<"/tutors/[id]">) {
  return <Suspense fallback={<PageSkeleton />}><Tutor params={props.params} /></Suspense>;
}
