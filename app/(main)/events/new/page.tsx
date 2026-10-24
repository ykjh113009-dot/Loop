import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { toLocalInput } from "@/lib/time";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { EventForm } from "./event-form";

export const metadata = { title: "New event" };

async function NewEvent({ searchParams }: { searchParams: PageProps<"/events/new">["searchParams"] }) {
  const me = await requireMe();
  if (me.isSuspended) redirect("/events");
  const supabase = await createClient();
  // Students can create events for clubs they lead. Moderators can also make school-wide ones.
  const { data } = await supabase
    .from("club_members")
    .select("club:clubs(id, name, emoji, status)")
    .eq("profile_id", me.id)
    .eq("role", "leader");
  const clubs = (data ?? []).map((d) => d.club).filter((c) => c && c.status === "approved") as { id: string; name: string; emoji: string }[];
  if (!me.isStaff && clubs.length === 0) redirect("/events");
  const { club } = await searchParams;

  return (
    <EventForm
      clubs={clubs}
      allowSchoolWide={me.isStaff}
      defaultClub={typeof club === "string" && clubs.some((c) => c.id === club) ? club : undefined}
      minStart={toLocalInput(new Date())}
    />
  );
}

export default function NewEventPage(props: PageProps<"/events/new">) {
  return (
    <>
      <PageHeader title="New event" back="/events" />
      <Suspense fallback={<PageSkeleton />}>
        <NewEvent searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
