import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { OpportunityForm } from "./opportunity-form";

export const metadata = { title: "Add an opportunity" };

async function New() {
  await requireMe();
  const supabase = await createClient();
  const { locale } = await getT();
  const { data: ok } = await supabase.rpc("can_manage_study_opportunities");
  if (!ok) redirect("/opportunities");
  return <div className="mx-auto max-w-2xl"><OpportunityForm locale={locale} draft={{ category: "scholarships", title: "", organization: "", description: "", eligibility: "", deadline: "", link: "", instructions: "", extra_info: "", docs: [], is_sample: false, hidden: false }} /></div>;
}

export default function NewOpportunityPage() {
  return (
    <>
      <PageHeader title="Add an opportunity" back="/opportunities" />
      <Suspense fallback={<PageSkeleton />}><New /></Suspense>
    </>
  );
}
