import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { LineIcon } from "@/components/line-icon";
import { ResourceCard } from "@/components/library/resource-card";
import { RESOURCE_COLUMNS, signCovers, type LibraryResource } from "@/lib/library";
import { signImages } from "@/lib/images";
import { AddCategoryForm, SubjectPhotos } from "./forms";

export const metadata = { title: "Academic Resources" };

function safeQuery(q: string) {
  return q.replace(/[%_,()"'\\*:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

async function Library({ q }: { q: string }) {
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const term = safeQuery(q);

  const { data: cats } = await supabase.from("study_categories").select("id, slug, name, emoji, sort, image_path").order("sort").order("name");
  const subjects = cats ?? [];
  const subjectImages = await signImages(supabase, subjects.map((c) => c.image_path));

  const live = () => supabase.from("library_resources").select(RESOURCE_COLUMNS).eq("visibility", "visible").is("deleted_at", null).not("published_at", "is", null);
  let results: LibraryResource[] = [];
  let top: LibraryResource[] = [];
  let recent: LibraryResource[] = [];
  const [{ data: canReview }, { data: canSubmit }] = await Promise.all([supabase.rpc("can_review_library"), supabase.rpc("can_submit_library")]);

  if (term) {
    const subjectIds = subjects.filter((s) => s.name.toLowerCase().includes(term.toLowerCase())).map((s) => s.id);
    const filters = [`title.ilike.%${term}%`, `description.ilike.%${term}%`, `author.ilike.%${term}%`];
    if (subjectIds.length) filters.push(`subject_id.in.(${subjectIds.join(",")})`);
    const { data } = await live().or(filters.join(",")).order("rating_count", { ascending: false }).order("published_at", { ascending: false }).limit(40);
    results = (data ?? []) as unknown as LibraryResource[];
  } else {
    const [{ data: ranked }, { data: rec }] = await Promise.all([
      supabase.rpc("library_top_rated", { p_limit: 5 }),
      live().order("published_at", { ascending: false }).limit(8),
    ]);
    recent = (rec ?? []) as unknown as LibraryResource[];
    const ids = (ranked ?? []).map((r) => r.resource_id);
    if (ids.length) {
      const { data } = await live().in("id", ids);
      const byId = new Map(((data ?? []) as unknown as LibraryResource[]).map((r) => [r.id, r]));
      top = ids.map((id) => byId.get(id)).filter((r): r is LibraryResource => !!r);
    }
  }
  const shown = term ? results : [...top, ...recent];
  const covers = await signCovers(supabase, shown.map((r) => r.cover_path));
  const card = (r: LibraryResource) => <ResourceCard key={r.id} r={r} cover={r.cover_path ? covers.get(r.cover_path) ?? null : null} t={t} />;

  const first = subjects.slice(0, 6);
  const more = subjects.slice(6);
  const tile = (c: (typeof subjects)[number]) => (
    <Link key={c.id} href={`/academic-resources/${c.slug}`} className="card flex items-center gap-3 p-3 hover:bg-black/[0.02]" data-category={c.slug}>
      <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-sage-soft/60 text-2xl">
        {c.image_path && subjectImages.get(c.image_path)
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          ? <img src={subjectImages.get(c.image_path)!} alt="" className="size-full object-cover" data-subject-photo />
          : c.emoji}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{c.name}</span>
      <span className="text-black/30 rtl:-scale-x-100">›</span>
    </Link>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-3">
        <p className="text-sm text-black/60">{t("Your school library, all in one place.")}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <form action="/academic-resources" className="relative flex-1" role="search">
            <span className="pointer-events-none absolute inset-y-0 start-3 flex items-center text-black/40"><LineIcon name="search" className="size-4" /></span>
            <input name="q" defaultValue={q} className="input ps-9" placeholder={t("Search titles, subjects or keywords")} aria-label={t("Search")} maxLength={60} />
          </form>
          <Link href="/academic-resources/suggest" className="btn-primary whitespace-nowrap text-center" data-suggest>＋ {t("Suggest a Resource")}</Link>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/academic-resources/my-library" className="chip bg-black/5">🔖 {t("My Library")}</Link>
          <Link href="/academic-resources/my-contributions" className="chip bg-black/5">📤 {t("My Contributions")}</Link>
          {canReview && <Link href="/academic-resources/review" className="chip bg-amber-50 text-amber-800">🛡️ {t("Review dashboard")}</Link>}
          {me.isAdmin && <Link href="/academic-resources/manage" className="chip bg-brand-50 text-brand-800">⚙️ {t("Manage library")}</Link>}
        </div>
        {!canSubmit && <p className="text-xs text-black/45">{t("Verified students, approved tutors and school staff can suggest resources.")}</p>}
      </div>

      {term ? (
        <section className="space-y-3" aria-live="polite">
          <h2 className="section-title">{t("Results for “{q}”", { q: term })}</h2>
          {results.length === 0 ? <p className="card p-4 text-sm text-black/55">{t("Nothing found. Try another word, or browse by subject.")}</p> : <div className="space-y-3">{results.map(card)}</div>}
        </section>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="section-title">{t("Browse by subject")}</h2>
            <div className="grid gap-2 sm:grid-cols-2">{first.map(tile)}</div>
            {more.length > 0 && (
              <details className="group">
                <summary className="cursor-pointer text-sm font-semibold text-brand-700">{t("Show all subjects")} ({more.length})</summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">{more.map(tile)}</div>
              </details>
            )}
            {me.isAdmin && (
              <details className="card p-4" data-subject-photos-panel>
                <summary className="cursor-pointer font-semibold">{t("Subject pictures")}</summary>
                <div className="mt-3">
                  <SubjectPhotos schoolId={me.school_id} userId={me.id} locale={locale} subjects={subjects.map((c) => ({ id: c.id, name: c.name, url: c.image_path ? subjectImages.get(c.image_path) ?? null : null }))} />
                </div>
              </details>
            )}
            {me.isAdmin && <details className="card p-4"><summary className="cursor-pointer font-semibold">{t("Add a subject")}</summary><div className="mt-3"><AddCategoryForm locale={locale} /></div></details>}
          </section>
          <section className="space-y-3" data-section="top-rated">
            <h2 className="section-title">⭐ {t("Top rated")}</h2>
            {top.length === 0 ? <p className="card p-4 text-sm text-black/55">{t("Top rated resources will appear here once students start rating.")}</p> : <div className="space-y-3">{top.map(card)}</div>}
          </section>
          <section className="space-y-3" data-section="recent">
            <h2 className="section-title">🆕 {t("Recently added")}</h2>
            {recent.length === 0 ? <p className="card p-4 text-sm text-black/55">{t("Nothing here yet. Be the first to suggest a resource!")}</p> : <div className="space-y-3">{recent.map(card)}</div>}
          </section>
        </>
      )}
    </div>
  );
}

async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return <Library q={q ?? ""} />;
}

export default function AcademicResourcesPage(props: PageProps<"/academic-resources">) {
  return (
    <>
      <PageHeader title="Academic Resources" />
      <Suspense fallback={<PageSkeleton />}><Page searchParams={props.searchParams as Promise<{ q?: string }>} /></Suspense>
    </>
  );
}
