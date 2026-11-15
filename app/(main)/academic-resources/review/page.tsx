import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { formatDateTime } from "@/lib/time";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { Avatar } from "@/components/avatar";
import { LIBRARY_TYPES } from "@/lib/library";

export const metadata = { title: "Review resources" };
const TABS = ["pending", "approved", "rejected", "flagged"] as const;

type Row = {
  id: string; resource_id: string; title: string; type: string; status: string; number: number; submitted_at: string | null; reviewed_at: string | null;
  submitter: { full_name: string; avatar: string } | null; subject: { name: string } | null;
};

async function Dashboard({ searchParams }: { searchParams: Promise<{ tab?: string; done?: string }> }) {
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? sp.tab! : "pending";
  await requireMe();
  const supabase = await createClient();
  const { t } = await getT();
  const { data: canReview } = await supabase.rpc("can_review_library");
  if (!canReview) redirect("/academic-resources");

  const counts = await Promise.all((["pending", "approved", "rejected"] as const).map((s) => supabase.from("library_revisions").select("id", { count: "exact", head: true }).eq("status", s)));
  const { count: flagCount } = await supabase.from("library_flags").select("id", { count: "exact", head: true }).eq("status", "open");
  const num = { pending: counts[0].count ?? 0, approved: counts[1].count ?? 0, rejected: counts[2].count ?? 0, flagged: flagCount ?? 0 };

  let rows: Row[] = [];
  let flags: { id: string; reason: string; created_at: string; resource: { id: string; title: string } | null }[] = [];
  if (tab === "flagged") {
    const { data } = await supabase.from("library_flags").select("id, reason, created_at, resource:library_resources!library_flags_resource_id_fkey(id, title)").eq("status", "open").order("created_at");
    flags = (data ?? []) as unknown as typeof flags;
  } else {
    const q = supabase.from("library_revisions")
      .select("id, resource_id, title, type, status, number, submitted_at, reviewed_at, submitter:profiles!library_revisions_submitter_id_fkey(full_name, avatar), subject:study_categories!library_revisions_subject_id_fkey(name)")
      .eq("status", tab);
    const { data } = await (tab === "pending" ? q.order("submitted_at", { ascending: true }) : q.order("reviewed_at", { ascending: false })).limit(80);
    rows = (data ?? []) as unknown as Row[];
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {sp.done && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">{sp.done === "approved" ? t("Approved. The student was notified.") : t("Sent back with your explanation. The student was notified.")}</p>}
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {TABS.map((k) => (
          <Link key={k} href={`/academic-resources/review?tab=${k}`} role="tab" aria-selected={tab === k}
            className={`rounded-full px-3 py-1 text-xs font-medium ${tab === k ? "bg-brand-700 text-white" : "bg-black/5 text-black/60"}`}>
            {k === "pending" ? t("Pending") : k === "approved" ? t("Approved") : k === "rejected" ? t("Rejected") : t("Flagged")} ({num[k]})
          </Link>
        ))}
      </div>
      {tab === "flagged" ? (
        flags.length === 0 ? <p className="card p-5 text-center text-sm text-black/55" data-empty>{t("No open flags.")}</p> : (
          <ul className="space-y-3">{flags.map((f) => (
            <li key={f.id} className="card space-y-1 p-4">
              <Link href={`/academic-resources/resource/${f.resource?.id}`} className="font-semibold hover:underline">{f.resource?.title}</Link>
              <p className="text-sm text-black/65">{f.reason}</p>
              <p className="text-xs text-black/40">{formatDateTime(f.created_at)}</p>
            </li>))}</ul>
        )
      ) : rows.length === 0 ? <p className="card p-5 text-center text-sm text-black/55" data-empty>{t("Nothing here.")}</p> : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/academic-resources/review/${r.id}`} className="card flex items-center gap-3 p-4 hover:bg-black/[0.02]" data-submission>
                {r.submitter && <Avatar avatar={r.submitter.avatar} />}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{r.title}</p>
                  <p className="truncate text-xs text-black/55">{r.submitter?.full_name} · {r.subject?.name} · {t((LIBRARY_TYPES[r.type] ?? LIBRARY_TYPES.other).label)}{r.number > 1 ? ` · ${t("update")}` : ""}</p>
                  <p className="text-xs text-black/40">{formatDateTime((tab === "pending" ? r.submitted_at : r.reviewed_at) ?? new Date())}</p>
                </div>
                <span className="text-black/30 rtl:-scale-x-100">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ReviewPage(props: PageProps<"/academic-resources/review">) {
  return (
    <>
      <PageHeader title="Review resources" back="/academic-resources" />
      <Suspense fallback={<PageSkeleton />}><Dashboard searchParams={props.searchParams as Promise<{ tab?: string; done?: string }>} /></Suspense>
    </>
  );
}
