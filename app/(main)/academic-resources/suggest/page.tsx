import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { saveLibraryResource } from "@/app/actions/library";
import { ResourceForm } from "../resource-form";

export const metadata = { title: "Suggest a Resource" };

async function Suggest({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const { subject } = await searchParams;
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const [{ data: subjects }, { data: canSubmit }] = await Promise.all([
    supabase.from("study_categories").select("id, name").order("sort").order("name"),
    supabase.rpc("can_submit_library"),
  ]);
  if (!canSubmit) {
    return <p className="card mx-auto max-w-2xl p-5 text-sm text-black/65">{t("Verified students, approved tutors and school staff can suggest resources.")}</p>;
  }
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <p className="text-sm text-black/60">{t("Share something useful with your school. After a quick review by the Student Council or an admin it appears in the library with your name on it, and you earn points.")}</p>
      <ResourceForm mode="community" subjects={subjects ?? []} schoolId={me.school_id} userId={me.id} locale={locale}
        initial={{ subject_id: subject && /^[0-9a-f-]{36}$/.test(subject) ? subject : undefined }} action={saveLibraryResource.bind(null, null)} />
    </div>
  );
}

export default function SuggestPage(props: PageProps<"/academic-resources/suggest">) {
  return (
    <>
      <PageHeader title="Suggest a Resource" back="/academic-resources" />
      <Suspense fallback={<PageSkeleton />}><Suggest searchParams={props.searchParams as Promise<{ subject?: string }>} /></Suspense>
    </>
  );
}
