import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { BookOpen, LayoutGrid, FileText, GraduationCap, Files, HelpCircle, ClipboardList, Search, Star, Clock, Bookmark, Upload, Plus, ShieldCheck, Settings } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/skeleton";
import { ResourceTile } from "@/components/library/resource-tile";
import { RESOURCE_COLUMNS, signCovers, type LibraryResource } from "@/lib/library";
import { signImages } from "@/lib/images";
import { AddCategoryForm, SubjectPhotos } from "./forms";

export const metadata = { title: "Academic Library" };

function safeQuery(q: string) {
  return q.replace(/[%_,()"'\\*:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

const FILTERS = [
  { id: "", label: "All Resources", icon: LayoutGrid, types: [] as string[] },
  { id: "notes", label: "Notes", icon: FileText, types: ["pdf_notes"] },
  { id: "textbooks", label: "Textbooks", icon: BookOpen, types: ["textbook", "digital_book"] },
  { id: "guides", label: "Study Guides", icon: GraduationCap, types: ["study_guide"] },
  { id: "papers", label: "Past Papers", icon: Files, types: ["past_paper"] },
  { id: "practice", label: "Practice", icon: HelpCircle, types: ["practice_questions"] },
  { id: "worksheets", label: "Worksheets", icon: ClipboardList, types: ["worksheet"] },
] as const;

async function Library({ q, type, view, allSubjects }: { q: string; type: string; view: string; allSubjects: boolean }) {
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const term = safeQuery(q);
  const filter = FILTERS.find((x) => x.id === type) ?? FILTERS[0];

  const { data: cats } = await supabase.from("study_categories").select("id, slug, name, emoji, sort, image_path").order("sort").order("name");
  const subjects = cats ?? [];
  const subjectImages = await signImages(supabase, subjects.map((c) => c.image_path));

  const live = () => {
    const base = supabase.from("library_resources").select(RESOURCE_COLUMNS).eq("visibility", "visible").is("deleted_at", null).not("published_at", "is", null);
    return filter.types.length ? base.in("type", [...filter.types]) : base;
  };
  let results: LibraryResource[] = [];
  let top: LibraryResource[] = [];
  let recent: LibraryResource[] = [];
  const [{ data: canReview }, { data: canSubmit }] = await Promise.all([supabase.rpc("can_review_library"), supabase.rpc("can_submit_library")]);
  const searching = !!term || !!filter.id;

  if (searching) {
    let query = live();
    if (term) {
      const subjectIds = subjects.filter((s) => s.name.toLowerCase().includes(term.toLowerCase())).map((s) => s.id);
      const filters = [`title.ilike.%${term}%`, `description.ilike.%${term}%`, `author.ilike.%${term}%`];
      if (subjectIds.length) filters.push(`subject_id.in.(${subjectIds.join(",")})`);
      query = query.or(filters.join(","));
    }
    const { data } = await query.order("rating_count", { ascending: false }).order("published_at", { ascending: false }).limit(40);
    results = (data ?? []) as unknown as LibraryResource[];
  } else {
    const [{ data: ranked }, { data: rec }] = await Promise.all([
      supabase.rpc("library_top_rated", { p_limit: view === "top" ? 40 : 4 }),
      live().order("published_at", { ascending: false }).limit(view === "recent" ? 40 : 8),
    ]);
    recent = (rec ?? []) as unknown as LibraryResource[];
    const ids = (ranked ?? []).map((r) => r.resource_id);
    if (ids.length) {
      const { data } = await live().in("id", ids);
      const byId = new Map(((data ?? []) as unknown as LibraryResource[]).map((r) => [r.id, r]));
      top = ids.map((id) => byId.get(id)).filter((r): r is LibraryResource => !!r);
    }
  }
  const shown = searching ? results : [...top, ...recent];
  const [covers, { data: savedRows }] = await Promise.all([
    signCovers(supabase, shown.map((r) => r.cover_path)),
    shown.length ? supabase.from("library_saves").select("resource_id").eq("profile_id", me.id).in("resource_id", shown.map((r) => r.id)) : Promise.resolve({ data: [] }),
  ]);
  const savedIds = new Set((savedRows ?? []).map((x) => x.resource_id));
  const tile = (r: LibraryResource) => <ResourceTile key={r.id} r={r} cover={r.cover_path ? covers.get(r.cover_path) ?? null : null} saved={savedIds.has(r.id)} t={t} />;
  const grid = "grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4";
  const href = (id: string) => `/academic-resources${id || term ? `?${new URLSearchParams({ ...(id ? { type: id } : {}), ...(term ? { q: term } : {}) })}` : ""}`;

  const visibleSubjects = allSubjects ? subjects : subjects.slice(0, 6);
  const subjectTile = (c: (typeof subjects)[number]) => (
    <Link key={c.id} href={`/academic-resources/${c.slug}`} className="flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-3xl border border-brand-700/10 bg-white/70 p-3 text-center shadow-[0_1px_2px_rgba(40,60,40,0.04)] hover:bg-white" data-category={c.slug}>
      <span className="flex size-14 items-center justify-center overflow-hidden rounded-2xl text-4xl">
        {c.image_path && subjectImages.get(c.image_path)
          // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
          ? <img src={subjectImages.get(c.image_path)!} alt="" className="size-full object-cover" data-subject-photo />
          : c.emoji}
      </span>
      <span className="text-[15px] font-medium">{c.name}</span>
    </Link>
  );
  const sectionHead = (icon: React.ReactNode, title: string, link?: { href: string; label: string }) => (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-[19px] font-semibold">{icon}{title}</h2>
      {link && <Link href={link.href} className="text-xs font-medium text-brand-700 hover:underline">{link.label} →</Link>}
    </div>
  );

  return (
    <div className="space-y-6" data-library-page data-wide>
      <section className="relative isolate overflow-hidden rounded-3xl bg-[#e9ead6] px-5 py-6 lg:px-8 lg:py-8" data-banner>
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand artwork */}
        <img src="/brand/library-hero.png" alt="" width={580} height={170} className="pointer-events-none absolute end-0 bottom-0 -z-10 hidden h-full w-auto object-contain object-right-bottom sm:block rtl:-scale-x-100" />
        <div className="flex items-center gap-4 lg:gap-6">
          <span className="hidden size-20 shrink-0 items-center justify-center rounded-3xl bg-[#d3dfc3] text-brand-800 sm:flex lg:size-24" aria-hidden="true"><BookOpen className="size-10 lg:size-12" strokeWidth={1.5} /></span>
          <div>
            <h1 className="font-heading text-[34px] leading-none font-semibold text-brand-900 lg:text-[48px]" data-banner-title>{t("Academic Library")}</h1>
            <p className="mt-2 max-w-md text-[13px] text-ink-2 lg:mt-3 lg:text-base">{t("Explore notes, textbooks, and study resources.")}</p>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <nav aria-label={t("Resource types")} className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" data-library-filters>
          {FILTERS.map(({ id, label, icon: Icon }) => (
            <Link key={id} href={href(id)} aria-current={filter.id === id ? "page" : undefined} className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium ${filter.id === id ? "border-brand-700 bg-brand-700 text-white" : "border-brand-700/10 bg-white/80 text-ink-2 hover:bg-white"}`}>
              <Icon className="size-[18px]" aria-hidden="true" />{t(label)}
            </Link>
          ))}
        </nav>
        <form action="/academic-resources" className="relative w-full sm:w-72" role="search">
          {filter.id && <input type="hidden" name="type" value={filter.id} />}
          <Search className="pointer-events-none absolute start-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-2" aria-hidden="true" />
          <input name="q" defaultValue={q} className="input !rounded-full !ps-11" placeholder={t("Search resources…")} aria-label={t("Search")} maxLength={60} />
        </form>
      </div>

      <div className="flex flex-wrap gap-2 text-sm" data-library-links>
        <Link href="/academic-resources/my-library" className="chip bg-white/80 px-3.5 py-1.5 shadow-sm hover:bg-white"><Bookmark className="size-4" aria-hidden="true" />{t("My Library")}</Link>
        <Link href="/academic-resources/my-contributions" className="chip bg-white/80 px-3.5 py-1.5 shadow-sm hover:bg-white"><Upload className="size-4" aria-hidden="true" />{t("My Contributions")}</Link>
        <Link href="/academic-resources/suggest" className="chip bg-brand-700 px-3.5 py-1.5 text-white" data-suggest><Plus className="size-4" aria-hidden="true" />{t("Suggest a Resource")}</Link>
        {canReview && <Link href="/academic-resources/review" className="chip bg-amber-50 px-3.5 py-1.5 text-amber-800"><ShieldCheck className="size-4" aria-hidden="true" />{t("Review dashboard")}</Link>}
        {me.isAdmin && <Link href="/academic-resources/manage" className="chip bg-brand-50 px-3.5 py-1.5 text-brand-800"><Settings className="size-4" aria-hidden="true" />{t("Manage library")}</Link>}
      </div>
      {!canSubmit && <p className="-mt-3 text-xs text-ink-2">{t("Verified students, approved tutors and school staff can suggest resources.")}</p>}

      {searching ? (
        <section aria-live="polite" data-section="results">
          {sectionHead(<Search className="size-5 text-brand-700" aria-hidden="true" />, term ? t("Results for “{q}”", { q: term }) : t(filter.label))}
          {results.length === 0 ? <p className="rounded-2xl bg-sage-soft/40 px-4 py-6 text-center text-sm text-ink-2">{t("Nothing found. Try another word, or browse by subject.")}</p> : <div className={grid}>{results.map(tile)}</div>}
        </section>
      ) : (
        <>
          {view !== "recent" && (
            <section data-section="top-rated">
              {sectionHead(<Star className="size-6 fill-amber-400 text-amber-500" aria-hidden="true" />, t("Top Rated"), view === "top" ? undefined : { href: "/academic-resources?view=top", label: t("See all") })}
              {top.length === 0 ? <p className="rounded-2xl bg-sage-soft/40 px-4 py-6 text-center text-sm text-ink-2">{t("Top rated resources will appear here once students start rating.")}</p> : <div className={grid}>{top.map(tile)}</div>}
            </section>
          )}
          {view !== "top" && (
            <section data-section="recent">
              {sectionHead(<Clock className="size-5 text-brand-700" aria-hidden="true" />, t("Recently Added"), view === "recent" ? undefined : { href: "/academic-resources?view=recent", label: t("See all") })}
              {recent.length === 0 ? <EmptyState compact scene="books" title={t("Your library is waiting for its first resources.")} action={{ href: "/academic-resources/suggest", label: t("Suggest a Resource") }}>{t("Share a study guide, past paper or notes and help everyone learn.")}</EmptyState> : <div className={grid}>{recent.map(tile)}</div>}
            </section>
          )}
          <section data-section="subjects" className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0">
              {sectionHead(<BookOpen className="size-5 text-brand-700" aria-hidden="true" />, t("Browse by Subject"), subjects.length > 6 ? { href: allSubjects ? "/academic-resources" : "/academic-resources?subjects=all", label: allSubjects ? t("Show fewer") : t("See all subjects") } : undefined)}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{visibleSubjects.map(subjectTile)}</div>
            </div>
            <aside className="relative isolate flex flex-col justify-end overflow-hidden rounded-3xl bg-[#e9ead6] p-6 lg:min-h-[250px]" data-promo>
              <GraduationCap className="pointer-events-none absolute end-6 top-4 -z-10 size-24 text-brand-800/80" strokeWidth={1.3} aria-hidden="true" />
              <h2 className="font-heading text-[26px] leading-tight font-semibold text-brand-900">{t("Study Smart with Loop")}</h2>
              <p className="mt-2 text-sm text-ink-2">{t("Your academic resources, all in one place.")}</p>
              <Link href="/academic-resources?view=recent" className="btn-primary mt-4 w-fit rounded-full px-5 py-2.5">{t("Explore More")} →</Link>
            </aside>
          </section>
          {me.isAdmin && (
            <details className="rounded-3xl border border-brand-700/10 bg-white/85 p-4" data-subject-photos-panel>
              <summary className="cursor-pointer font-semibold">{t("Subject pictures")}</summary>
              <div className="mt-3">
                <SubjectPhotos schoolId={me.school_id} userId={me.id} locale={locale} subjects={subjects.map((c) => ({ id: c.id, name: c.name, url: c.image_path ? subjectImages.get(c.image_path) ?? null : null }))} />
              </div>
            </details>
          )}
          {me.isAdmin && <details className="rounded-3xl border border-brand-700/10 bg-white/85 p-4"><summary className="cursor-pointer font-semibold">{t("Add a subject")}</summary><div className="mt-3"><AddCategoryForm locale={locale} /></div></details>}
        </>
      )}
    </div>
  );
}

async function Page({ searchParams }: { searchParams: Promise<{ q?: string; type?: string; view?: string; subjects?: string }> }) {
  const sp = await searchParams;
  return <Library q={typeof sp.q === "string" ? sp.q : ""} type={typeof sp.type === "string" ? sp.type : ""} view={sp.view === "top" || sp.view === "recent" ? sp.view : ""} allSubjects={sp.subjects === "all"} />;
}

export default function AcademicResourcesPage(props: PageProps<"/academic-resources">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Page searchParams={props.searchParams as Promise<{ q?: string; type?: string; view?: string; subjects?: string }>} />
    </Suspense>
  );
}
