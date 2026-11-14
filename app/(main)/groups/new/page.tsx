import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { NewGroupForm } from "./form";

export const metadata = { title: "New group" };

async function New() {
  const me = await requireMe();
  const supabase = await createClient();
  const { locale } = await getT();
  const { data: roles } = await supabase.from("leadership_roles").select("kind").eq("profile_id", me.id).in("kind", ["council_member", "school_staff"]);
  const official = me.isAdmin || (roles ?? []).length > 0;
  return <NewGroupForm official={official} locale={locale} />;
}

export default function NewGroupPage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="New group" back="/groups" />
      <Suspense fallback={<PageSkeleton />}>
        <New />
      </Suspense>
    </div>
  );
}
