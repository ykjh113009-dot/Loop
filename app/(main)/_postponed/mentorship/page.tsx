import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { Avatar } from "@/components/avatar";
import { PageBanner } from "@/components/ui/page-banner";
import { SectionTabs } from "@/components/ui/section-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/skeleton";
import { Glyph } from "@/components/glyph";

export const metadata = { title: "Mentorship" };

async function Mentorship() {
  await requireMe();
  const { t } = await getT();
  const supabase = await createClient();
  const { data: mentors } = await supabase.from("profiles").select("id, full_name, avatar, alumni_year, university, major, bio").not("alumni_year", "is", null).is("deactivated_at", null).not("onboarded_at", "is", null).order("alumni_year", { ascending: false }).limit(60);
  return (
    <div className="space-y-5" data-mentorship>
      <PageBanner title={t("Mentorship")} subtitle={t("Guidance from people who have been there.")} note={t("Alumni share how they chose a university and a major.")} scene="books" />
      <SectionTabs label={t("Mentorship")} current="/mentorship" items={[{ href: "/mentorship", label: t("Mentors"), icon: "mentor" }, { href: "/tawjihi", label: t("Tawjihi corner"), icon: "graduation" }, { href: "/opportunities", label: t("Universities"), icon: "globe" }]} />
      {(mentors ?? []).length === 0 ? (
        <EmptyState scene="books" title={t("No mentors have joined yet")} action={{ href: "/tawjihi", label: t("Open the Tawjihi corner") }}>
          {t("Alumni mentors will appear here. Meanwhile, ask your questions in the Tawjihi corner.")}
        </EmptyState>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2" data-card="mentors">
          {(mentors ?? []).map((m) => (
            <li key={m.id}><Link href={`/profile/${m.id}`} className="card flex items-start gap-3 p-4 hover:border-brand-700/25">
              <Avatar avatar={m.avatar} size="md" />
              <span className="min-w-0"><span className="block truncate font-semibold">{m.full_name}</span>
                <span className="block text-xs text-ink-2">{t("Class of {y}", { y: m.alumni_year ?? "" })}</span>
                {(m.major || m.university) && <span className="mt-1 block text-sm"><Glyph e="🎓" /> {[m.major, m.university].filter(Boolean).join(" · ")}</span>}
                {m.bio && <span className="mt-1 line-clamp-2 block text-xs text-ink-2">{m.bio}</span>}</span></Link></li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MentorshipPage() {
  return <Suspense fallback={<PageSkeleton />}><Mentorship /></Suspense>;
}
