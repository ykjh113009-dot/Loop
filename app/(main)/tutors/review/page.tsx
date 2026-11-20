import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { timeAgo } from "@/lib/time";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Tutor applications" };

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending Review", cls: "bg-amber-50 text-amber-800" },
  approved: { label: "Approved", cls: "bg-brand-50 text-brand-800" },
  rejected: { label: "Rejected", cls: "bg-red-50 text-red-700" },
  draft: { label: "Draft", cls: "bg-black/5 text-black/55" },
};

async function Queue({ searchParams }: { searchParams: PageProps<"/tutors/review">["searchParams"] }) {
  await requireMe();
  const supabase = await createClient();
  const { t } = await getT();
  const { data: ok } = await supabase.rpc("can_review_tutors");
  if (!ok) redirect("/tutors");
  const { tab: raw } = await searchParams;
  const tab = raw === "decided" ? "decided" : "pending";
  const { data } = await supabase
    .from("tutor_applications")
    .select("id, status, subjects, other_subjects, submitted_at, reviewed_at, profile:profiles!tutor_applications_profile_id_fkey(full_name, grade)")
    .in("status", tab === "pending" ? ["pending"] : ["approved", "rejected"])
    .order(tab === "pending" ? "submitted_at" : "reviewed_at", { ascending: tab === "pending" })
    .limit(100);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex gap-1 rounded-xl bg-black/5 p-1" role="tablist">
        {[["pending", t("Pending Review")], ["decided", t("Decided")]].map(([id, label]) => (
          <Link key={id} role="tab" aria-selected={tab === id} href={`/tutors/review?tab=${id}`} className={`flex-1 rounded-lg py-1.5 text-center text-sm font-medium ${tab === id ? "bg-brand-700 text-white shadow-sm" : "text-black/55 hover:bg-sage-soft/60"}`}>{label}</Link>
        ))}
      </div>
      {(data ?? []).length === 0 ? <Empty emoji="🧑‍🏫" title={tab === "pending" ? t("No applications are waiting") : t("Nothing decided yet")} /> : (
        <ul className="space-y-2">
          {(data ?? []).map((a) => (
            <li key={a.id}>
              <Link href={`/tutors/review/${a.id}`} className="card flex items-center gap-3 p-4 hover:bg-black/[0.02]" data-application={a.id}>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{a.profile?.full_name} <span className="text-xs font-normal text-black/45">· {t("Grade")} {a.profile?.grade}</span></p>
                  <p className="truncate text-xs text-black/55">{[...a.subjects, ...(a.other_subjects ? [a.other_subjects] : [])].join(", ")}</p>
                </div>
                <span className={`chip shrink-0 ${STATUS[a.status].cls}`}>{t(STATUS[a.status].label)}</span>
                <span className="shrink-0 text-xs text-black/40">{timeAgo(a.reviewed_at ?? a.submitted_at ?? new Date().toISOString())}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function TutorReviewPage(props: PageProps<"/tutors/review">) {
  return (
    <>
      <PageHeader title="Tutor applications" back="/tutors" />
      <Suspense fallback={<PageSkeleton />}><Queue searchParams={props.searchParams} /></Suspense>
    </>
  );
}
