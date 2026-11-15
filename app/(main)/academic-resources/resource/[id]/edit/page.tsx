import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { saveLibraryResource, saveOfficialResource } from "@/app/actions/library";
import { signCovers } from "@/lib/library";
import { ResourceForm } from "../../../resource-form";

async function Edit({ params }: { params: PageProps<"/academic-resources/resource/[id]/edit">["params"] }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const [{ data: r }, { data: subjects }] = await Promise.all([
    supabase.from("library_resources").select("id, source, submitter_id, subject_id, title, description, type, author, cover_path, file_name, file_size, file_mime, link_url, downloadable, visibility, published_at, deleted_at, latest_revision_id").eq("id", id).maybeSingle(),
    supabase.from("study_categories").select("id, name").order("sort").order("name"),
  ]);
  if (!r || r.deleted_at) notFound();
  const official = r.source === "official";
  if (official ? !me.isAdmin : r.submitter_id !== me.id) redirect(`/academic-resources/resource/${id}`);

  if (official) {
    const covers = await signCovers(supabase, [r.cover_path]);
    return (
      <div className="mx-auto max-w-2xl">
        <ResourceForm mode="official" subjects={subjects ?? []} schoolId={me.school_id} userId={me.id} locale={locale}
          initial={{ ...r, cover_url: r.cover_path ? covers.get(r.cover_path) : null }} action={saveOfficialResource.bind(null, null)} />
      </div>
    );
  }
  const { data: rev } = await supabase.from("library_revisions").select("*").eq("id", r.latest_revision_id ?? "").maybeSingle();
  const cur = rev ?? r;
  const covers = await signCovers(supabase, [cur.cover_path]);
  const live = !!r.published_at;
  return (
    <div className="mx-auto max-w-2xl">
      <ResourceForm mode="community" subjects={subjects ?? []} schoolId={me.school_id} userId={me.id} locale={locale}
        notice={live ? t("Your changes will be reviewed before they go live. The current version stays visible until then.") : undefined}
        initial={{ ...cur, id: r.id, file_path: rev?.file_path ?? null, cover_url: cur.cover_path ? covers.get(cur.cover_path) : null }}
        action={saveLibraryResource.bind(null, null)} />
    </div>
  );
}

export default function EditPage(props: PageProps<"/academic-resources/resource/[id]/edit">) {
  return (
    <>
      <Back params={props.params} />
      <Suspense fallback={<PageSkeleton />}><Edit params={props.params} /></Suspense>
    </>
  );
}

function Back({ params }: { params: PageProps<"/academic-resources/resource/[id]/edit">["params"] }) {
  return <Suspense fallback={<PageHeader title="Edit resource" />}><BackInner params={params} /></Suspense>;
}
async function BackInner({ params }: { params: PageProps<"/academic-resources/resource/[id]/edit">["params"] }) {
  const { id } = await params;
  return <PageHeader title="Edit resource" back={`/academic-resources/resource/${id}`} />;
}
