import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, GraduationCap, HeartHandshake } from "lucide-react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { formatDate } from "@/lib/time";
import { RESOURCE_COLUMNS, signCovers, type LibraryResource } from "@/lib/library";
import { signImages } from "@/lib/images";
import { Avatar } from "@/components/avatar";
import { DashCard } from "@/components/dashboard/card";
import { PageSkeleton } from "@/components/skeleton";
import { ResourceCard } from "@/components/library/resource-card";
import { PageBanner } from "@/components/ui/page-banner";
import { SectionTabs } from "@/components/ui/section-tabs";
import { EmptyState } from "@/components/ui/empty-state";

export const metadata = { title: "Learning Hub" };

async function LearningHub() {
  await requireMe();
  const { t } = await getT();
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const live = () => supabase.from("library_resources").select(RESOURCE_COLUMNS).eq("visibility", "visible").is("deleted_at", null).not("published_at", "is", null);
  const [{ data: ranked }, { data: recent }, { data: subjects }, { data: tutors }, { data: opps }, { count: mentors }] = await Promise.all([
    supabase.rpc("library_top_rated", { p_limit: 3 }),
    live().order("published_at", { ascending: false }).limit(3),
    supabase.from("study_categories").select("id, slug, name, emoji, sort").order("sort").limit(8),
    supabase.from("tutor_profiles").select("profile_id, subjects, photo_path, profile:profiles(id, full_name, avatar, grade)").not("approved_at", "is", null).eq("active", true).limit(3),
    supabase.from("study_opportunities").select("id, title, organization, deadline, category").eq("status", "active").gte("deadline", today).order("deadline").limit(3),
    supabase.from("profiles").select("id", { count: "exact", head: true }).not("alumni_year", "is", null).is("deactivated_at", null).not("onboarded_at", "is", null),
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
        { href: "/academic-resources", label: t("Library"), icon: "library" }, { href: "/tutors", label: t("Tutors"), icon: "tutors" },
        { href: "/mentorship", label: t("Mentorship"), icon: "mentor" }, { href: "/opportunities", label: t("Universities"), icon: "graduation" },
      ]} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <DashCard title={popular.length ? t("Popular resources") : t("Recently added")} href="/academic-resources" linkLabel={t("See all")}>
            <p className="mb-3 text-xs text-ink-2">{t("Explore notes, textbooks, past papers and study guides.")}</p>
            {(subjects ?? []).length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5" data-subjects>
                {(subjects ?? []).map((s) => <Link key={s.id} href={`/academic-resources/${s.slug}`} className="chip bg-white shadow-sm hover:bg-brand-50">{s.emoji} {s.name}</Link>)}
              </div>
            )}
            {shown.length === 0 ? (
              <EmptyState compact scene="books" title={t("Your library is waiting for its first resources.")} action={{ href: "/academic-resources/suggest", label: t("Suggest a Resource") }} secondary={{ href: "/academic-resources", label: t("Open the library") }}>
                {t("Share a study guide, past paper or notes and help everyone learn.")}
              </EmptyState>
            ) : <div className="space-y-3" data-card="resources">{shown.map((r) => <ResourceCard key={r.id} r={r} cover={r.cover_path ? covers.get(r.cover_path) ?? null : null} t={t} />)}</div>}
          </DashCard>

          <DashCard title={t("University & Opportunities")} href="/opportunities" linkLabel={t("See all")}>
            <p className="mb-3 text-xs text-ink-2">{t("Scholarships, programs and deadlines to plan your next step.")}</p>
            {(opps ?? []).length === 0 ? (
              <EmptyState compact scene="books" title={t("No opportunities listed yet")} action={{ href: "/opportunities", label: t("Explore opportunities") }}>
                {t("Scholarships and programs appear here as soon as your school adds them.")}
              </EmptyState>
            ) : (
              <ul className="divide-y divide-black/5" data-card="opportunities">
                {(opps ?? []).map((o) => (
                  <li key={o.id}><Link href={`/opportunities/${o.id}`} className="flex items-center gap-3 py-2.5 hover:bg-black/[0.02]"><GraduationCap className="size-5 shrink-0 text-brand-700" strokeWidth={1.8} aria-hidden="true" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{o.title}</span><span className="block truncate text-xs text-ink-2">{o.organization}</span></span>
                    <span className="shrink-0 text-xs text-ink-2">{t("Deadline")} {formatDate(o.deadline!)}</span></Link></li>
                ))}
              </ul>
            )}
          </DashCard>
        </div>

        <div className="space-y-5">
          <DashCard title={t("Find a Tutor")} href="/tutors" linkLabel={t("See all")}>
            <p className="mb-3 text-xs text-ink-2">{t("Find students who can help you learn, or share your own knowledge.")}</p>
            {(tutors ?? []).length === 0 ? (
              <EmptyState compact dog="waiting" title={t("No approved tutors available yet.")} action={{ href: "/tutors/apply", label: t("Become a Tutor") }}>
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
          <DashCard title={t("Mentorship")} href="/mentorship" linkLabel={t("See all")}>
            <div className="flex items-start gap-3">
              <HeartHandshake className="mt-0.5 size-6 shrink-0 text-brand-700" strokeWidth={1.7} aria-hidden="true" />
              <div className="space-y-1.5 text-sm">
                <p className="text-ink-2">{t("Learn from alumni who already walked this road: universities, majors and how they got there.")}</p>
                <p className="font-semibold">{(mentors ?? 0) > 0 ? t("{n} alumni mentors", { n: mentors ?? 0 }) : t("Mentors will appear here when alumni join.")}</p>
                <Link href="/mentorship" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">{t("Meet the mentors")} <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" /></Link>
              </div>
            </div>
          </DashCard>
        </div>
      </div>
    </div>
  );
}

export default function LearningHubPage() {
  return <Suspense fallback={<PageSkeleton />}><LearningHub /></Suspense>;
}
