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
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { SubmitButton } from "@/components/submit-button";
import { AskTutorForm } from "../forms";

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
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <article className="card space-y-4 p-5">
        <div className="flex items-center gap-4">
          {x.photo_path && photos.get(x.photo_path) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photos.get(x.photo_path)!} alt="" className="size-20 rounded-full object-cover" />
          ) : <Avatar avatar={x.profile.avatar} size="lg" />}
          <div className="min-w-0">
            <h2 className="text-xl font-bold">{x.profile.full_name}</h2>
            <p className="text-sm text-black/55">{t("Grade")} {x.profile.grade} · {t(formatLabel(x.format))}</p>
            {!x.active && <span className="chip bg-amber-50 text-amber-800">{t("Paused")}</span>}
          </div>
        </div>
        <section><h3 className="section-title">{t("Subjects")}</h3><div className="flex flex-wrap gap-1.5">{x.subjects.map((s) => <span key={s} className="chip bg-brand-50 text-brand-800">{s}</span>)}</div></section>
        {x.about && <section><h3 className="section-title">{t("About me")}</h3><p className="text-sm whitespace-pre-wrap text-black/75">{x.about}</p></section>}
        {x.qualifications && <section><h3 className="section-title">{t("Qualifications")}</h3><p className="text-sm whitespace-pre-wrap text-black/75">{x.qualifications}</p></section>}
        {x.experience && <section><h3 className="section-title">{t("Experience")}</h3><p className="text-sm whitespace-pre-wrap text-black/75">{x.experience}</p></section>}
        <section>
          <h3 className="section-title">{t("Availability")}</h3>
          <div className="flex flex-wrap gap-1">{DAYS.map((d) => <span key={d.id} className={`chip ${x.days.includes(d.id) ? "bg-brand-700 text-white" : "bg-black/5 text-black/35"}`}>{t(d.label)}</span>)}</div>
          <p className="mt-2 text-sm text-black/70">{[x.hours, x.preferred_times].filter(Boolean).join(" · ") || x.availability}</p>
        </section>
      </article>

      {canAct && (
        <section className="card space-y-3 p-5">
          <h3 className="font-bold">{t("Book a session")}</h3>
          <p className="text-sm text-black/60">{t("Send a request and plan a time together, or just say hello first.")}</p>
          <AskTutorForm tutorId={x.profile.id} subjects={x.subjects} />
          <form action={startChat}>
            <input type="hidden" name="profileId" value={x.profile.id} />
            <SubmitButton className="btn-secondary w-full" pendingText="…">💬 {t("Message")}</SubmitButton>
          </form>
        </section>
      )}
      {mine && <Link href="/tutors/me" className="btn-primary w-full">{t("Edit my tutor profile")}</Link>}
    </div>
  );
}

export default function TutorPage(props: PageProps<"/tutors/[id]">) {
  return (
    <>
      <PageHeader title="Tutor" back="/tutors" />
      <Suspense fallback={<PageSkeleton />}><Tutor params={props.params} /></Suspense>
    </>
  );
}
