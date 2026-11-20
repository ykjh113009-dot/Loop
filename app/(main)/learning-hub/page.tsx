import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { RESOURCE_COLUMNS, signCovers, type LibraryResource } from "@/lib/library";
import { signImages } from "@/lib/images";
import { Avatar } from "@/components/avatar";
import { DashCard } from "@/components/dashboard/card";
import { PageSkeleton } from "@/components/skeleton";
import { ResourceCard } from "@/components/library/resource-card";
import { PageBanner } from "@/components/ui/page-banner";
import { SectionTabs } from "@/components/ui/section-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { Glyph } from "@/components/glyph";

export const metadata = { title: "Learning Hub" };

async function LearningHub() {
  await requireMe();
  const { t } = await getT();
  const supabase = await createClient();
  const live = () => supabase.from("library_resources").select(RESOURCE_COLUMNS).eq("visibility", "visible").is("deleted_at", null).not("published_at", "is", null);
  const [{ data: ranked }, { data: recent }, { data: subjects }, { data: tutors }] = await Promise.all([
    supabase.rpc("library_top_rated", { p_limit: 3 }),
    live().order("published_at", { ascending: false }).limit(3),
    supabase.from("study_categories").select("id, slug, name, emoji, sort").order("sort").limit(8),
    supabase.from("tutor_profiles").select("profile_id, subjects, photo_path, profile:profiles(id, full_name, avatar, grade)").not("approved_at", "is", null).eq("active", true).limit(3),
  ]);
  const ids = (ranked ?? []).map((r) => r.resource_id);
  let popular: LibraryResource[] = [];
  if (ids.length) {
    const { data } = await live().in("id", ids);
    const byId = new Map(((data ?? []) as unknown as LibraryResource[]).map((r) => [r.id, r]));
    popular = ids.map((id) => byId.get(id)).filter((r): r is LibraryResource => !!r);
  }
  const shown = popular.length ? popular : ((recent ?? []) as unknown as LibraryResource[]);
  const [covers, photos] = await Promise.all([signCovers(supabase, shown.map((r) => r.cover_path)), signImages(supabase, (tutors ?? []).map((x) => x.photo_path))]);

  return (
    <div className="space-y-5" data-category-page="learning-hub">
      <PageBanner title={t("Learning Hub")} subtitle={t("Learn. Prepare. Achieve.")} note={t("Your academic hub in one place.")} scene="books" />
      <SectionTabs label={t("Learning Hub")} current="" items={[
        { href: "/academic-resources", label: t("Academic Library"), icon: "library" }, { href: "/tutors", label: t("Tutors Directory"), icon: "tutors" },
      ]} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <DashCard title={t("Academic Library")} href="/academic-resources" linkLabel={t("See all")}>
            <p className="mb-3 text-xs text-ink-2">{t("Explore notes, textbooks, past papers and study guides.")}</p>
            <div className="mb-3 flex flex-wrap gap-2" data-library-links>
              <Link href="/academic-resources/my-library" className="chip bg-white shadow-sm hover:bg-brand-50">{t("My Library")}</Link>
              <Link href="/academic-resources/my-contributions" className="chip bg-white shadow-sm hover:bg-brand-50">{t("My Contributions")}</Link>
              <Link href="/academic-resources/suggest" className="chip bg-white shadow-sm hover:bg-brand-50">{t("Suggest a Resource")}</Link>
            </div>
            <h3 className="mb-2 text-sm font-semibold">{popular.length ? t("Popular resources") : t("Recently added")}</h3>
            {(subjects ?? []).length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5" data-subjects>
                {(subjects ?? []).map((s) => <Link key={s.id} href={`/academic-resources/${s.slug}`} className="chip bg-white shadow-sm hover:bg-brand-50"><Glyph e={s.emoji} /> {s.name}</Link>)}
              </div>
            )}
            {shown.length === 0 ? (
              <EmptyState compact scene="books" title={t("Your library is waiting for its first resources.")} action={{ href: "/academic-resources/suggest", label: t("Suggest a Resource") }} secondary={{ href: "/academic-resources", label: t("Open the library") }}>
                {t("Share a study guide, past paper or notes and help everyone learn.")}
              </EmptyState>
            ) : <div className="space-y-3" data-card="resources">{shown.map((r) => <ResourceCard key={r.id} r={r} cover={r.cover_path ? covers.get(r.cover_path) ?? null : null} t={t} />)}</div>}
          </DashCard>
        </div>

        <div className="space-y-5">
          <DashCard title={t("Tutors Directory")} href="/tutors" linkLabel={t("See all")}>
            <p className="mb-3 text-xs text-ink-2">{t("Find students who can help you learn, or share your own knowledge.")}</p>
            {(tutors ?? []).length === 0 ? (
              <EmptyState compact scene="books" title={t("No approved tutors available yet.")} action={{ href: "/tutors/apply", label: t("Become a Tutor") }}>
                {t("Tutors are approved by the school before they appear here.")}
              </EmptyState>
            ) : (
              <ul className="space-y-2" data-card="tutors">
                {(tutors ?? []).map((x) => {
                  const p = x.profile as unknown as { id: string; full_name: string; avatar: string; grade: number | null } | null;
                  if (!p) return null;
                  const photo = x.photo_path ? photos.get(x.photo_path) : null;
                  return (
                    <li key={p.id} className="flex items-center gap-3 rounded-xl bg-brand-50/60 p-2.5">
                      {photo
                        // eslint-disable-next-line @next/next/no-img-element -- private signed link
                        ? <img src={photo} alt="" className="size-10 rounded-full object-cover" />
                        : <Avatar avatar={p.avatar} />}
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{p.full_name}</span><span className="block truncate text-xs text-ink-2">{(x.subjects ?? []).slice(0, 3).join(", ")}</span></span>
                      <Link href={`/tutors/${p.id}`} className="btn-secondary px-3 py-1.5 text-xs">{t("Contact")}</Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </DashCard>
        </div>
      </div>
    </div>
  );
}

export default function LearningHubPage() {
  return <Suspense fallback={<PageSkeleton />}><LearningHub /></Suspense>;
}
