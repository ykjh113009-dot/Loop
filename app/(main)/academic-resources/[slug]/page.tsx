import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { ResourceCard } from "@/components/library/resource-card";
import { RESOURCE_COLUMNS, signCovers, type LibraryResource } from "@/lib/library";
import { signImages } from "@/lib/images";

const SORTS = { new: "Newest", top: "Top rated", views: "Most viewed" } as const;

async function Subject({ params, searchParams }: { params: PageProps<"/academic-resources/[slug]">["params"]; searchParams: Promise<{ sort?: string }> }) {
  const { slug } = await params;
  const { sort: sortParam } = await searchParams;
  const sort = sortParam === "top" || sortParam === "views" ? sortParam : "new";
  await requireMe();
  const supabase = await createClient();
  const { t } = await getT();
  const { data: cat } = await supabase.from("study_categories").select("id, name, emoji, image_path").eq("slug", slug).maybeSingle();
  if (!cat) notFound();
  const banner = cat.image_path ? (await signImages(supabase, [cat.image_path])).get(cat.image_path) : null;
  let q = supabase.from("library_resources").select(RESOURCE_COLUMNS).eq("subject_id", cat.id).eq("visibility", "visible").is("deleted_at", null).not("published_at", "is", null);
  q = sort === "top" ? q.order("rating_avg", { ascending: false }).order("rating_count", { ascending: false })
    : sort === "views" ? q.order("views_count", { ascending: false })
    : q.order("published_at", { ascending: false });
  const { data } = await q.limit(60);
  const list = (data ?? []) as unknown as LibraryResource[];
  const covers = await signCovers(supabase, list.map((r) => r.cover_path));
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {banner && (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
        <img src={banner} alt="" className="h-36 w-full rounded-2xl object-cover" data-subject-banner />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1.5" role="tablist" aria-label={t("Sort")}>
          {(Object.keys(SORTS) as (keyof typeof SORTS)[]).map((k) => (
            <Link key={k} href={`/academic-resources/${slug}?sort=${k}`} role="tab" aria-selected={sort === k}
              className={`rounded-full px-3 py-1 text-xs font-medium ${sort === k ? "bg-brand-700 text-white" : "bg-black/5 text-black/60"}`}>{t(SORTS[k])}</Link>
          ))}
        </div>
        <Link href={`/academic-resources/suggest?subject=${cat.id}`} className="btn-secondary text-sm">＋ {t("Suggest a Resource")}</Link>
      </div>
      {list.length === 0
        ? <p className="card p-5 text-center text-sm text-black/55" data-empty>{t("No resources in {s} yet. Be the first to suggest one!", { s: cat.name })}</p>
        : <div className="space-y-3">{list.map((r) => <ResourceCard key={r.id} r={r} cover={r.cover_path ? covers.get(r.cover_path) ?? null : null} t={t} />)}</div>}
    </div>
  );
}

async function Title({ params }: { params: PageProps<"/academic-resources/[slug]">["params"] }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: cat } = await supabase.from("study_categories").select("name, emoji").eq("slug", slug).maybeSingle();
  return <PageHeader title={cat ? `${cat.emoji} ${cat.name}` : "Academic Resources"} back="/academic-resources" />;
}

export default function SubjectPage(props: PageProps<"/academic-resources/[slug]">) {
  return (
    <>
      <Suspense fallback={<PageHeader title="Academic Resources" back="/academic-resources" />}><Title params={props.params} /></Suspense>
      <Suspense fallback={<PageSkeleton />}><Subject params={props.params} searchParams={props.searchParams as Promise<{ sort?: string }>} /></Suspense>
    </>
  );
}
