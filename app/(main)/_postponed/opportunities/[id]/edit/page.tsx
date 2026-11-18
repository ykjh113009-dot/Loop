import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { OpportunityForm } from "../../new/opportunity-form";

export const metadata = { title: "Edit opportunity" };

async function Edit({ params }: { params: PageProps<"/opportunities/[id]/edit">["params"] }) {
  const { id } = await params;
  await requireMe();
  const supabase = await createClient();
  const { locale } = await getT();
  const { data: ok } = await supabase.rpc("can_manage_study_opportunities");
  if (!ok) redirect("/opportunities");
  const { data: o } = await supabase.from("study_opportunities").select("*").eq("id", id).maybeSingle();
  if (!o) notFound();
  return (
    <div className="mx-auto max-w-2xl">
      <OpportunityForm locale={locale} draft={{
        id: o.id, category: o.category, title: o.title, organization: o.organization, description: o.description, eligibility: o.eligibility,
        deadline: o.deadline ?? "", link: o.link ?? "", instructions: o.instructions, extra_info: o.extra_info,
        docs: (Array.isArray(o.documents) ? o.documents : []) as { label: string; url: string }[], is_sample: o.is_sample, hidden: o.status === "hidden",
      }} />
    </div>
  );
}

export default function EditOpportunityPage(props: PageProps<"/opportunities/[id]/edit">) {
  return (
    <>
      <PageHeader title="Edit opportunity" back="/opportunities" />
      <Suspense fallback={<PageSkeleton />}><Edit params={props.params} /></Suspense>
    </>
  );
}
