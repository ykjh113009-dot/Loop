import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { DAYS, DOC_KINDS, formatLabel } from "@/lib/tutor";
import { formatDateTime } from "@/lib/time";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { DecisionForm } from "./decision-form";
import { Glyph } from "@/components/glyph";

export const metadata = { title: "Tutor application" };

const ACTION_LABEL: Record<string, string> = { save: "Saved a draft", submit: "Submitted", resubmit: "Submitted again", withdraw: "Took it back", approve: "Approved", reject: "Needs changes" };

async function Review({ params }: { params: PageProps<"/tutors/review/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data: ok } = await supabase.rpc("can_review_tutors");
  if (!ok) redirect("/tutors");
  const { data: a } = await supabase
    .from("tutor_applications")
    .select("*, profile:profiles!tutor_applications_profile_id_fkey(id, full_name, avatar, grade)")
    .eq("id", id).maybeSingle();
  if (!a || !a.profile) notFound();
  const [{ data: docs }, { data: history }, { data: priv }] = await Promise.all([
    supabase.from("tutor_application_documents").select("id, name, kind, size, path").eq("application_id", id).order("created_at"),
    supabase.from("tutor_application_events").select("id, action, note, created_at, actor:profiles!tutor_application_events_actor_id_fkey(full_name)").eq("application_id", id).order("created_at", { ascending: false }),
    supabase.from("private_profiles").select("email").eq("id", a.profile_id).maybeSingle(),
  ]);
  // Documents are private: links are made for this reviewer only and expire in an hour.
  const signed = new Map<string, string>();
  if ((docs ?? []).length) {
    const { data } = await supabase.storage.from("tutor-docs").createSignedUrls((docs ?? []).map((d) => d.path), 3600);
    for (const d of data ?? []) if (d.path && d.signedUrl) signed.set(d.path, d.signedUrl);
  }
  const row = (label: string, value: string | undefined | null) => (
    <div className="py-2"><dt className="text-xs text-black/45">{label}</dt><dd className="text-sm whitespace-pre-wrap">{value || <span className="text-black/35">—</span>}</dd></div>
  );
  const subjects = [...a.subjects, ...(a.other_subjects ? a.other_subjects.split(/[,\n;]/).map((x: string) => x.trim()).filter(Boolean) : [])];
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <article className="card space-y-3 p-5">
        <div className="flex items-center gap-3">
          <Avatar avatar={a.profile.avatar} size="lg" />
          <div className="min-w-0 flex-1"><h2 className="text-lg font-bold">{a.profile.full_name}</h2><p className="truncate text-sm text-black/55">{priv?.email}</p></div>
          <span className={`chip ${a.status === "pending" ? "bg-amber-50 text-amber-800" : a.status === "approved" ? "bg-brand-50 text-brand-800" : a.status === "rejected" ? "bg-red-50 text-red-700" : "bg-black/5"}`}>
            {t(a.status === "pending" ? "Pending Review" : a.status === "approved" ? "Approved" : a.status === "rejected" ? "Rejected" : "Draft")}
          </span>
        </div>
        <dl className="divide-y divide-black/5">
          {row(t("Submitted"), a.submitted_at ? formatDateTime(a.submitted_at) : null)}
          {row(t("Grade"), a.grade)}{row(t("Subjects"), subjects.join(", "))}
          {row(t("Grades and achievements"), a.achievements)}{row(t("Tutoring experience"), a.experience)}{row(t("Qualifications"), a.qualifications)}
          {row(t("Introduction"), a.intro)}{row(t("Why a tutor"), a.motivation)}{row(t("Topics"), a.topics)}
          {row(t("Format"), t(formatLabel(a.format)))}
          {row(t("Days"), a.days.map((d: string) => t(DAYS.find((x) => x.id === d)?.label ?? d)).join(", "))}
          {row(t("Hours"), [a.hours, a.preferred_times].filter(Boolean).join(" · "))}{row(t("Availability notes"), a.availability_notes)}
        </dl>
      </article>

      <section className="card space-y-2 p-4">
        <h3 className="section-title">{t("Private documents")}</h3>
        {(docs ?? []).length === 0 ? <p className="text-sm text-black/50">{t("No documents.")}</p> : (
          <ul className="divide-y divide-black/5 text-sm">
            {(docs ?? []).map((d) => (
              <li key={d.id} className="flex items-center gap-2 py-2">
                <span><Glyph e="📄" /></span>
                <a href={signed.get(d.path)} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-brand-700 underline">{d.name}</a>
                <span className="chip bg-black/5">{t(DOC_KINDS.find((k) => k.id === d.kind)?.label ?? d.kind)}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-black/45">{t("Only you, the other reviewers and the applicant can open these.")}</p>
      </section>

      {a.status === "pending" && a.profile_id !== me.id && (
        <section className="card p-4"><h3 className="section-title">{t("Your decision")}</h3><DecisionForm id={a.id} locale={locale} /></section>
      )}
      {a.status === "pending" && a.profile_id === me.id && <p className="card p-4 text-sm text-black/60">{t("Another reviewer has to decide on your own application.")}</p>}

      <section className="card p-4">
        <h3 className="section-title">{t("History")}</h3>
        <ul className="space-y-1 text-sm">
          {(history ?? []).map((h) => (
            <li key={h.id} className="flex justify-between gap-2"><span>{t(ACTION_LABEL[h.action] ?? h.action)} · {h.actor?.full_name}{h.note && <span className="text-black/55"> · “{h.note}”</span>}</span><span className="shrink-0 text-xs text-black/40">{formatDateTime(h.created_at)}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function TutorReviewDetailPage(props: PageProps<"/tutors/review/[id]">) {
  return (
    <>
      <PageHeader title="Tutor application" back="/tutors/review" />
      <Suspense fallback={<PageSkeleton />}><Review params={props.params} /></Suspense>
    </>
  );
}
