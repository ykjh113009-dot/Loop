import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { PushToggle } from "@/components/push-toggle";
import { PageSkeleton } from "@/components/skeleton";
import { EditProfileForm } from "./edit-form";

export const metadata = { title: "Edit profile" };

async function Edit() {
  const me = await requireMe();
  const supabase = await createClient();
  const [{ data: interests }, { data: mine }] = await Promise.all([
    supabase.from("interests").select("id, name, emoji").order("name"),
    supabase.from("profile_interests").select("interest_id").eq("profile_id", me.id),
  ]);
  return (
    <>
      <PageHeader title="Edit profile" back={`/profile/${me.id}`} />
      <div className="space-y-4">
        <p className="text-sm text-black/55">
          Your name ({me.full_name}) comes from your school account, and only your school admin can change your grade ({me.grade}).
        </p>
        <EditProfileForm interests={interests ?? []} avatar={me.avatar} bio={me.bio} picked={(mine ?? []).map((m) => m.interest_id)} />
        <PushToggle />
      </div>
    </>
  );
}

export default function EditProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Edit />
    </Suspense>
  );
}
