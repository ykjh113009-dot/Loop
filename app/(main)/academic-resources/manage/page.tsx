import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { LIBRARY_TYPES } from "@/lib/library";
import { PointsForm } from "./points-form";

export const metadata = { title: "Manage library" };

async function Manage() {
  const me = await requireMe();
  if (!me.isAdmin) redirect("/academic-resources");
  const supabase = await createClient();
  const { t, locale } = await getT();
  const [{ data: official }, { data: points }] = await Promise.all([
    supabase.from("library_resources").select("id, title, type, visibility, views_count, subject:study_categories!library_resources_subject_id_fkey(name)").eq("source", "official").is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.rpc("library_points"),
  ]);
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <section className="card space-y-3 p-4">
        <h2 className="section-title">{t("Points for shared resources")}</h2>
        <p className="text-sm text-black/60">{t("Students earn this once for each resource that is approved. Editing or re-sharing never earns more.")}</p>
        <PointsForm current={points ?? 10} locale={locale} />
      </section>
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="section-title">{t("Official library")}</h2>
          <Link href="/academic-resources/manage/new" className="btn-primary text-sm" data-add-official>＋ {t("Add an Official resource")}</Link>
        </div>
        {(official ?? []).length === 0 ? <p className="card p-5 text-center text-sm text-black/55">{t("No Official resources yet.")}</p> : (
          <ul className="space-y-2">{(official ?? []).map((r) => (
            <li key={r.id} className="card flex items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <Link href={`/academic-resources/resource/${r.id}`} className="block truncate font-semibold hover:underline">{r.title}</Link>
                <p className="text-xs text-black/50">{(r.subject as unknown as { name: string } | null)?.name} · {t((LIBRARY_TYPES[r.type] ?? LIBRARY_TYPES.other).label)}{r.visibility === "hidden" ? ` · ${t("Hidden")}` : ""}</p>
              </div>
              <Link href={`/academic-resources/resource/${r.id}/edit`} className="btn-ghost text-sm">{t("Edit")}</Link>
            </li>))}</ul>
        )}
      </section>
    </div>
  );
}

export default function ManagePage() {
  return (
    <>
      <PageHeader title="Manage library" back="/academic-resources" />
      <Suspense fallback={<PageSkeleton />}><Manage /></Suspense>
    </>
  );
}
