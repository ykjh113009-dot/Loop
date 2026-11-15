import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { ResourceCard } from "@/components/library/resource-card";
import { RESOURCE_COLUMNS, signCovers, type LibraryResource } from "@/lib/library";

export const metadata = { title: "My Library" };

async function Mine() {
  await requireMe();
  const supabase = await createClient();
  const { t } = await getT();
  const { data: saves } = await supabase.from("library_saves").select("resource_id, created_at").order("created_at", { ascending: false }).limit(200);
  const ids = (saves ?? []).map((s) => s.resource_id);
  const { data } = ids.length
    ? await supabase.from("library_resources").select(RESOURCE_COLUMNS).in("id", ids).eq("visibility", "visible").is("deleted_at", null).not("published_at", "is", null)
    : { data: [] };
  const byId = new Map(((data ?? []) as unknown as LibraryResource[]).map((r) => [r.id, r]));
  const list = ids.map((id) => byId.get(id)).filter((r): r is LibraryResource => !!r);
  const covers = await signCovers(supabase, list.map((r) => r.cover_path));
  return (
    <div className="mx-auto max-w-3xl space-y-3">
      <p className="text-sm text-black/60">{t("Resources you saved. Only you can see this page.")}</p>
      {list.length === 0
        ? <div className="card p-5 text-center text-sm text-black/55" data-empty>{t("You have not saved anything yet.")} <Link href="/academic-resources" className="font-semibold text-brand-700">{t("Browse the library")}</Link></div>
        : list.map((r) => <ResourceCard key={r.id} r={r} cover={r.cover_path ? covers.get(r.cover_path) ?? null : null} t={t} />)}
    </div>
  );
}

export default function MyLibraryPage() {
  return (
    <>
      <PageHeader title="My Library" back="/academic-resources" />
      <Suspense fallback={<PageSkeleton />}><Mine /></Suspense>
    </>
  );
}
