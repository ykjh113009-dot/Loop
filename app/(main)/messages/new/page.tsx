import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { GroupForm } from "./group-form";

export const metadata = { title: "New group chat" };

async function NewGroup() {
  const me = await requireMe();
  const supabase = await createClient();
  const { locale } = await getT();
  const [{ data: students }, { data: a }, { data: b }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar, grade").is("deactivated_at", null).is("alumni_year", null)
      .neq("role", "counselor").not("onboarded_at", "is", null).neq("id", me.id).order("full_name").limit(1000),
    supabase.from("friendships").select("b_id").eq("a_id", me.id),
    supabase.from("friendships").select("a_id").eq("b_id", me.id),
  ]);
  const friends = new Set([...(a ?? []).map((x) => x.b_id), ...(b ?? []).map((x) => x.a_id)]);
  const people = (students ?? []).map((s) => ({ ...s, friend: friends.has(s.id) })).sort((x, y) => Number(y.friend) - Number(x.friend));
  return <GroupForm people={people} locale={locale} schoolId={me.school_id} />;
}

export default function NewGroupPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="New group chat" back="/messages" />
      <Suspense fallback={<PageSkeleton />}>
        <NewGroup />
      </Suspense>
    </div>
  );
}
