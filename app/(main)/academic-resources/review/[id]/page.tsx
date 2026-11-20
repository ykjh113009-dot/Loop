import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { formatDateTime } from "@/lib/time";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { Avatar } from "@/components/avatar";
import { LIBRARY_TYPES, STATUS_LABEL, signCovers } from "@/lib/library";
import { ReviewForm } from "../review-form";
import { Glyph } from "@/components/glyph";

async function Detail({ params }: { params: PageProps<"/academic-resources/review/[id]">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data: canReview } = await supabase.rpc("can_review_library");
  if (!canReview) redirect("/academic-resources");
  const { data: rv } = await supabase.from("library_revisions")
    .select("*, submitter:profiles!library_revisions_submitter_id_fkey(full_name, avatar), subject:study_categories!library_revisions_subject_id_fkey(name)")
    .eq("id", id).maybeSingle();
  if (!rv) notFound();
  const [{ data: live }, { data: history }, { data: subjects }] = await Promise.all([
    supabase.from("library_resources").select("title, description, type, author, link_url, file_name, cover_path, downloadable, subject_id, published_at, live_revision_id").eq("id", rv.resource_id).maybeSingle(),
    supabase.from("library_decisions").select("id, decision, note, created_at, revision_id, reviewer:profiles!library_decisions_reviewer_id_fkey(full_name)").eq("resource_id", rv.resource_id).order("created_at", { ascending: false }),
    supabase.from("study_categories").select("id, name"),
  ]);
  const covers = await signCovers(supabase, [rv.cover_path]);
  const isUpdate = !!live?.published_at;
  const subjectName = (sid: string) => subjects?.find((s) => s.id === sid)?.name ?? "";
  const typeLabel = (v: string) => t((LIBRARY_TYPES[v] ?? LIBRARY_TYPES.other).label);
  const submitter = rv.submitter as unknown as { full_name: string; avatar: string } | null;

  const rows: [string, string, string | null][] = [
    [t("Title"), rv.title, isUpdate ? live!.title : null],
    [t("Subject"), subjectName(rv.subject_id), isUpdate ? subjectName(live!.subject_id) : null],
    [t("Type"), typeLabel(rv.type), isUpdate ? typeLabel(live!.type) : null],
    [t("Description"), rv.description, isUpdate ? live!.description : null],
    [t("Author or source"), rv.author, isUpdate ? live!.author : null],
    [t("File"), rv.file_name ?? "", isUpdate ? live!.file_name ?? "" : null],
    [t("Link"), rv.link_url ?? "", isUpdate ? live!.link_url ?? "" : null],
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="card flex items-center gap-3 p-4">
        {submitter && <Avatar avatar={submitter.avatar} size="lg" />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{submitter?.full_name}</p>
          <p className="text-xs text-black/50">{rv.submitted_at ? `${t("Sent")} ${formatDateTime(rv.submitted_at)}` : t("Not sent yet")}</p>
          <span className="chip mt-1 bg-black/5">{t(STATUS_LABEL[rv.status])}{isUpdate ? ` · ${t("update to a published resource")}` : ""}</span>
        </div>
        {rv.cover_path && covers.get(rv.cover_path) && (
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          <img src={covers.get(rv.cover_path)!} alt="" className="h-20 w-16 rounded-xl object-cover" />
        )}
      </div>

      <section className="card space-y-2 p-4" data-section="content">
        <h2 className="section-title">{isUpdate ? t("What changed") : t("Submission")}</h2>
        <dl className="divide-y divide-black/5">
          {rows.map(([k, now, before]) => {
            const changed = before !== null && before !== now;
            return (
              <div key={k} className="py-2">
                <dt className="text-xs text-black/45">{k}</dt>
                <dd className="whitespace-pre-wrap break-words text-sm">{now || <span className="text-black/35">—</span>}</dd>
                {changed && <dd className="mt-1 whitespace-pre-wrap break-words rounded-lg bg-black/[0.04] px-2 py-1 text-xs text-black/55" data-before>{t("Before")}: {before || "—"}</dd>}
              </div>
            );
          })}
        </dl>
        <div className="flex flex-wrap gap-2 pt-1">
          {rv.file_path && (rv.file_mime === "application/pdf" || rv.file_mime?.startsWith("image/")) && (
            <Link href={`/academic-resources/resource/${rv.resource_id}/read?rev=${rv.id}`} className="btn-secondary text-sm" data-preview><Glyph e="👁" /> {t("Preview file")}</Link>
          )}
          {rv.file_path && <a href={`/api/library/${rv.resource_id}/file?kind=download&rev=${rv.id}`} className="btn-ghost text-sm"><Glyph e="⬇" /> {t("Download file")}</a>}
          {rv.link_url && <a href={rv.link_url} target="_blank" rel="noopener noreferrer nofollow" className="btn-secondary text-sm" data-open-link><Glyph e="↗" /> {t("Open link")}</a>}
        </div>
      </section>

      {rv.status === "pending" && rv.submitter_id !== me.id && (
        <section className="card space-y-3 p-4"><h2 className="section-title">{t("Decision")}</h2><ReviewForm id={rv.id} hasFile={!!rv.file_path} locale={locale} /></section>
      )}
      {rv.status === "pending" && rv.submitter_id === me.id && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{t("This is your own submission. Another reviewer has to decide.")}</p>}
      {rv.status !== "pending" && rv.review_note && <p className="rounded-xl bg-black/[0.04] p-3 text-sm"><strong>{t("Message to the student")}:</strong> {rv.review_note}</p>}

      <section className="space-y-2" data-section="history">
        <h2 className="section-title">{t("Previous decisions")}</h2>
        {(history ?? []).length === 0 ? <p className="text-sm text-black/50">{t("No decisions yet.")}</p> : (
          <ul className="space-y-2">{(history ?? []).map((h) => (
            <li key={h.id} className="card p-3 text-sm"><strong>{h.decision === "approved" ? t("Approved") : t("Rejected")}</strong> · {(h.reviewer as unknown as { full_name: string } | null)?.full_name} · <span className="text-black/45">{formatDateTime(h.created_at)}</span>{h.note && <p className="mt-1 text-black/65">{h.note}</p>}</li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}

export default function ReviewDetailPage(props: PageProps<"/academic-resources/review/[id]">) {
  return (
    <>
      <PageHeader title="Review" back="/academic-resources/review" />
      <Suspense fallback={<PageSkeleton />}><Detail params={props.params} /></Suspense>
    </>
  );
}
