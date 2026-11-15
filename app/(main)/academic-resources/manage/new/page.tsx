import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { saveOfficialResource } from "@/app/actions/library";
import { ResourceForm } from "../../resource-form";

async function New({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const { subject } = await searchParams;
  const me = await requireMe();
  if (!me.isAdmin) redirect("/academic-resources");
  const supabase = await createClient();
  const { locale } = await getT();
  const { data: subjects } = await supabase.from("study_categories").select("id, name").order("sort").order("name");
  return (
    <div className="mx-auto max-w-2xl">
      <ResourceForm mode="official" subjects={subjects ?? []} schoolId={me.school_id} userId={me.id} locale={locale}
        initial={{ subject_id: subject && /^[0-9a-f-]{36}$/.test(subject) ? subject : undefined, downloadable: true }} action={saveOfficialResource.bind(null, null)} />
    </div>
  );
}

export default function NewOfficialPage(props: PageProps<"/academic-resources/manage/new">) {
  return (
    <>
      <PageHeader title="Add an Official resource" back="/academic-resources/manage" />
      <Suspense fallback={<PageSkeleton />}><New searchParams={props.searchParams as Promise<{ subject?: string }>} /></Suspense>
    </>
  );
}
