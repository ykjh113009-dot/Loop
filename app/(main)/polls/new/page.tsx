import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toLocalInput } from "@/lib/time";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { PollForm } from "./poll-form";

export const metadata = { title: "New poll" };

async function NewPoll() {
  const me = await requireMe();
  if (me.isSuspended) redirect("/polls");
  const supabase = await createClient();
  const { data } = await supabase.from("club_members").select("club:clubs(id, name, emoji, status)").eq("profile_id", me.id).eq("role", "leader");
  const clubs = (data ?? []).map((d) => d.club).filter((c) => c?.status === "approved") as { id: string; name: string; emoji: string }[];
  if (!me.isStaff && clubs.length === 0) redirect("/polls");
  const now = new Date();
  return (
    <PollForm
      clubs={clubs}
      allowSchoolWide={me.isStaff}
      minClose={toLocalInput(now)}
      defaultClose={toLocalInput(new Date(now.getTime() + 3 * 24 * 3600 * 1000))}
    />
  );
}

export default function NewPollPage() {
  return (
    <>
      <PageHeader title="New poll" back="/polls" />
      <Suspense fallback={<PageSkeleton />}>
        <NewPoll />
      </Suspense>
    </>
  );
}
