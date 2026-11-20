import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { ViewTracker } from "@/components/library/view-tracker";
import { Glyph } from "@/components/glyph";

async function Reader({ params, searchParams }: { params: PageProps<"/academic-resources/resource/[id]/read">["params"]; searchParams: Promise<{ rev?: string }> }) {
  const { id } = await params;
  const { rev } = await searchParams;
  if (!/^[0-9a-f-]{36}$/.test(id) || (rev && !/^[0-9a-f-]{36}$/.test(rev))) notFound();
  const me = await requireMe();
  const supabase = await createClient();
  const { t } = await getT();
  const { data: info } = await supabase.rpc("library_file_info", { p_resource: id, p_kind: "read", p_revision: rev ?? undefined });
  const file = info as { name: string | null; mime: string | null } | null;
  if (!file) notFound();
  const { data: r } = await supabase.from("library_resources").select("title, submitter_id, published_at").eq("id", id).maybeSingle();
  const src = `/api/library/${id}/file?kind=read${rev ? `&rev=${rev}` : ""}`;
  const isImage = file.mime?.startsWith("image/");
  return (
    <div className="space-y-3">
      {!rev && r?.published_at && r.submitter_id !== me.id && <ViewTracker id={id} />}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-semibold">{r?.title}</p>
        <a href={src} target="_blank" rel="noopener noreferrer" className="btn-ghost text-sm"><Glyph e="↗" /> {t("Open in a new tab")}</a>
      </div>
      {isImage
        // eslint-disable-next-line @next/next/no-img-element -- private file served through the library route
        ? <img src={src} alt={r?.title ?? ""} className="mx-auto max-h-[80dvh] rounded-xl" />
        : <iframe src={src} title={r?.title ?? t("Resource")} className="h-[80dvh] w-full rounded-xl border border-black/10 bg-white" data-reader />}
      <p className="text-xs text-black/45">{t("Not loading? Use “Open in a new tab”.")}</p>
    </div>
  );
}

export default function ReadPage(props: PageProps<"/academic-resources/resource/[id]/read">) {
  return (
    <>
      <Suspense fallback={<PageHeader title="Reader" />}><Back params={props.params} /></Suspense>
      <Suspense fallback={<PageSkeleton />}><Reader params={props.params} searchParams={props.searchParams as Promise<{ rev?: string }>} /></Suspense>
    </>
  );
}

async function Back({ params }: { params: PageProps<"/academic-resources/resource/[id]/read">["params"] }) {
  const { id } = await params;
  return <PageHeader title="Reader" back={`/academic-resources/resource/${id}`} />;
}
