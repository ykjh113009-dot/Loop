import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { PublishForm } from "./publish-form";

export const metadata = { title: "Publish an opportunity" };

async function New({ searchParams }: { searchParams: PageProps<"/volunteering/new">["searchParams"] }) {
  const me = await requireMe();
  if (!me.isStudent || me.isSuspended) redirect("/volunteering");
  const supabase = await createClient();
  const { locale } = await getT();
  const { event } = await searchParams;
  const { data: canPublish } = await supabase.rpc("can_publish_volunteering");
  // Events this person organizes (anyone who runs an event can add roles to it).
  const { data: upcoming } = await supabase.from("events").select("id, title, created_by, status").eq("status", "approved").gte("starts_at", new Date().toISOString()).order("starts_at").limit(60);
  const manageable: { id: string; title: string }[] = [];
  for (const e of upcoming ?? []) {
    const { data: ok } = await supabase.rpc("can_manage_event_id", { p_event: e.id });
    if (ok) manageable.push({ id: e.id, title: e.title });
  }
  if (!canPublish && manageable.length === 0) redirect("/volunteering");
  return (
    <div className="mx-auto max-w-2xl">
      <PublishForm locale={locale} events={manageable} draft={{
        title: "", description: "", requirements: "", location: "", spots: null, starts_at: "", ends_at: "",
        event_id: typeof event === "string" && manageable.some((m) => m.id === event) ? event : "",
      }} />
    </div>
  );
}

export default function NewOpportunityPage(props: PageProps<"/volunteering/new">) {
  return (
    <>
      <PageHeader title="Publish an opportunity" back="/volunteering?tab=organize" />
      <Suspense fallback={<PageSkeleton />}><New searchParams={props.searchParams} /></Suspense>
    </>
  );
}
