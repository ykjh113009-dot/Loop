import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { formatDateTime } from "@/lib/time";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { ApplyForm } from "./apply-form";
import { WithdrawButton } from "./withdraw-button";

export const metadata = { title: "Become a tutor" };

const ACTION_LABEL: Record<string, string> = { save: "Saved a draft", submit: "Submitted", resubmit: "Submitted again", withdraw: "Took it back", approve: "Approved", reject: "Needs changes" };

async function Apply() {
  const me = await requireMe();
  if (!me.isStudent) redirect("/tutors");
  const supabase = await createClient();
  const { t, locale } = await getT();
  const [{ data: app }, { data: priv }] = await Promise.all([
    supabase.from("tutor_applications").select("*").eq("profile_id", me.id).maybeSingle(),
    supabase.from("private_profiles").select("email").eq("id", me.id).maybeSingle(),
  ]);
  if (app?.status === "approved") redirect("/tutors/me");
  const [{ data: docs }, { data: history }] = app
    ? await Promise.all([
        supabase.from("tutor_application_documents").select("id, name, kind, size").eq("application_id", app.id).order("created_at"),
        supabase.from("tutor_application_events").select("id, action, note, created_at").eq("application_id", app.id).order("created_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }];

  if (app?.status === "pending") {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <div className="card space-y-2 p-5">
          <span className="chip bg-amber-50 text-amber-800">⏳ {t("Pending review")}</span>
          <h2 className="text-lg font-bold">{t("Your application is with the reviewers")}</h2>
          <p className="text-sm text-black/65">{t("Submitted {d}. We will notify you when an admin or the Student Council decides.", { d: formatDateTime(app.submitted_at ?? app.updated_at) })}</p>
          <p className="text-sm text-black/65">{t("Subjects")}: <strong>{[...app.subjects, ...(app.other_subjects ? app.other_subjects.split(/[,\n;]/).map((x: string) => x.trim()).filter(Boolean) : [])].join(", ")}</strong></p>
          <WithdrawButton locale={locale} />
        </div>
        <Link href="/tutors" className="btn-secondary w-full">{t("Back to the directory")}</Link>
      </div>
    );
  }

  const initial = {
    grade: app?.grade || (me.grade ? `Grade ${me.grade}` : ""), subjects: app?.subjects ?? [], other_subjects: app?.other_subjects ?? "",
    achievements: app?.achievements ?? "", experience: app?.experience ?? "", qualifications: app?.qualifications ?? "", intro: app?.intro ?? "",
    motivation: app?.motivation ?? "", topics: app?.topics ?? "", format: app?.format ?? "both", days: app?.days ?? [], hours: app?.hours ?? "",
    preferred_times: app?.preferred_times ?? "", availability_notes: app?.availability_notes ?? "", photo_path: app?.photo_path ?? null,
  };
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {app?.status === "rejected" && <span className="chip bg-red-50 text-red-700">{t("Needs changes")}</span>}
      <ApplyForm initial={initial} docs={docs ?? []} user={{ name: me.full_name, email: priv?.email ?? "", avatar: me.avatar }} locale={locale}
        schoolId={me.school_id} userId={me.id} feedback={app?.status === "rejected" ? app.review_note : null} />
      {(history ?? []).length > 0 && (
        <section className="card p-4">
          <h2 className="section-title">{t("History")}</h2>
          <ul className="space-y-1 text-sm">
            {(history ?? []).map((h) => <li key={h.id} className="flex justify-between gap-2"><span>{t(ACTION_LABEL[h.action] ?? h.action)}{h.note && <span className="text-black/55"> · “{h.note}”</span>}</span><span className="shrink-0 text-xs text-black/40">{formatDateTime(h.created_at)}</span></li>)}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function ApplyPage() {
  return (
    <>
      <PageHeader title="Become a tutor" back="/tutors" />
      <Suspense fallback={<PageSkeleton />}><Apply /></Suspense>
    </>
  );
}
