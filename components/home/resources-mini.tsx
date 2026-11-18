import Link from "next/link";
import { BookOpen } from "lucide-react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { RESOURCE_COLUMNS, signCovers, type LibraryResource } from "@/lib/library";
import { ResourceTabs } from "@/components/home/resource-tabs";

export async function ResourcesMini() {
  await requireMe();
  const { t } = await getT();
  const supabase = await createClient();
  const live = () => supabase.from("library_resources").select(RESOURCE_COLUMNS).eq("visibility", "visible").is("deleted_at", null).not("published_at", "is", null);
  const [{ data: ranked }, { data: recent }] = await Promise.all([supabase.rpc("library_top_rated", { p_limit: 3 }), live().order("published_at", { ascending: false }).limit(3)]);
  const ids = (ranked ?? []).map((r) => r.resource_id);
  let top: LibraryResource[] = [];
  if (ids.length) {
    const { data } = await live().in("id", ids);
    const by = new Map(((data ?? []) as unknown as LibraryResource[]).map((r) => [r.id, r]));
    top = ids.map((id) => by.get(id)).filter((r): r is LibraryResource => !!r);
  }
  const rec = (recent ?? []) as unknown as LibraryResource[];
  const covers = await signCovers(supabase, [...top, ...rec].map((r) => r.cover_path));
  const map = (rs: LibraryResource[]) => rs.map((r) => ({ id: r.id, title: r.title, subject: r.subject?.name ?? "", rating: Number(r.rating_avg ?? 0), count: Number(r.rating_count ?? 0), cover: r.cover_path ? covers.get(r.cover_path) ?? null : null }));
  return (
    <section className="rounded-2xl border border-brand-700/10 bg-white/80 p-4 lg:p-5" data-card="resources">
      <header className="mb-2 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[17px] font-semibold"><BookOpen className="size-5 text-brand-700" strokeWidth={1.8} aria-hidden="true" />{t("Academic Resources")}</h2>
        <Link href="/academic-resources" className="text-xs font-medium text-brand-700 hover:underline">{t("See all")} →</Link>
      </header>
      <ResourceTabs topLabel={t("Top Rated")} recentLabel={t("Recently Added")} empty={t("Your library is waiting for its first resources.")} top={map(top)} recent={map(rec)} />
    </section>
  );
}
