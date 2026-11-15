import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { formatDate } from "@/lib/time";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { LIBRARY_TYPES, STATUS_LABEL } from "@/lib/library";
import { DeleteButton } from "../resource/[id]/forms";

export const metadata = { title: "My Contributions" };
const TABS = ["all", "pending", "approved", "rejected", "draft"] as const;
const TONE: Record<string, string> = { draft: "bg-black/5 text-black/60", pending: "bg-amber-50 text-amber-800", approved: "bg-brand-50 text-brand-800", rejected: "bg-red-50 text-red-700" };

async function Contributions({ searchParams }: { searchParams: Promise<{ status?: string; sent?: string; saved?: string }> }) {
  const sp = await searchParams;
  const tab = (TABS as readonly string[]).includes(sp.status ?? "") ? sp.status! : "all";
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const [{ data: resources }, { data: revs }, { data: ledger }] = await Promise.all([
    supabase.from("library_resources").select("id, title, type, published_at, points_awarded, visibility, latest_revision_id, updated_at, subject:study_categories!library_resources_subject_id_fkey(name)").eq("submitter_id", me.id).eq("source", "community").is("deleted_at", null).order("updated_at", { ascending: false }),
    supabase.from("library_revisions").select("id, resource_id, status, review_note, number, submitted_at, reviewed_at").eq("submitter_id", me.id),
    supabase.from("points_ledger").select("points").eq("profile_id", me.id).eq("reason", "library_resource"),
  ]);
  const latest = new Map((revs ?? []).map((r) => [r.id, r]));
  const rows = (resources ?? []).map((r) => {
    const rev = r.latest_revision_id ? latest.get(r.latest_revision_id) : undefined;
    // An approved resource with a newer waiting version shows the waiting one.
    return { r, rev, status: rev?.status ?? "draft" };
  });
  const count = (s: string) => rows.filter((x) => s === "all" || x.status === s).length;
  const shown = rows.filter((x) => tab === "all" || x.status === tab);
  const earned = (ledger ?? []).reduce((a, b) => a + b.points, 0);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {sp.sent && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">{t("Sent! A reviewer will look at it soon. We will notify you.")}</p>}
      {sp.saved && <p role="status" className="rounded-xl bg-brand-50 p-3 text-sm text-brand-800">{t("Draft saved. Only you can see it.")}</p>}
      <div className="card flex items-center justify-between gap-3 p-4">
        <div><p className="text-sm text-black/55">{t("Points earned from resources")}</p><p className="text-2xl font-bold" data-points>⭐ {earned}</p></div>
        <Link href="/academic-resources/suggest" className="btn-primary">＋ {t("Suggest a Resource")}</Link>
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {TABS.map((k) => (
          <Link key={k} href={`/academic-resources/my-contributions${k === "all" ? "" : `?status=${k}`}`} role="tab" aria-selected={tab === k}
            className={`rounded-full px-3 py-1 text-xs font-medium ${tab === k ? "bg-brand-700 text-white" : "bg-black/5 text-black/60"}`}>
            {k === "all" ? t("All") : t(STATUS_LABEL[k])} ({count(k)})
          </Link>
        ))}
      </div>
      {shown.length === 0 && <p className="card p-5 text-center text-sm text-black/55" data-empty>{t("Nothing here yet.")}</p>}
      <ul className="space-y-3">
        {shown.map(({ r, rev, status }) => (
          <li key={r.id} className="card space-y-2 p-4" data-contribution={status}>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`chip ${TONE[status]}`}>{t(STATUS_LABEL[status])}{r.published_at && status !== "approved" ? ` · ${t("update")}` : ""}</span>
              <span className="text-xs text-black/50">{(r.subject as unknown as { name: string } | null)?.name} · {t((LIBRARY_TYPES[r.type] ?? LIBRARY_TYPES.other).label)}</span>
              {r.points_awarded && r.published_at && <span className="chip bg-amber-50 text-amber-800">⭐ {t("Points earned")}</span>}
            </div>
            <Link href={`/academic-resources/resource/${r.id}`} className="block font-semibold hover:underline">{r.title}</Link>
            {rev?.status === "rejected" && rev.review_note && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-800"><strong>{t("Feedback")}:</strong> {rev.review_note}</p>}
            <p className="text-xs text-black/40">{rev?.submitted_at ? `${t("Sent")} ${formatDate(rev.submitted_at)}` : t("Not sent yet")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Link href={`/academic-resources/resource/${r.id}`} className="btn-ghost text-sm">{t("Open")}</Link>
              <Link href={`/academic-resources/resource/${r.id}/edit`} className="btn-secondary text-sm" data-edit>{status === "rejected" ? t("Edit and resubmit") : status === "draft" ? t("Continue") : t("Edit")}</Link>
              <DeleteButton id={r.id} locale={locale} warn={t("Delete this resource? It will disappear from the library.")} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MyContributionsPage(props: PageProps<"/academic-resources/my-contributions">) {
  return (
    <>
      <PageHeader title="My Contributions" back="/academic-resources" />
      <Suspense fallback={<PageSkeleton />}><Contributions searchParams={props.searchParams as Promise<{ status?: string; sent?: string; saved?: string }>} /></Suspense>
    </>
  );
}
