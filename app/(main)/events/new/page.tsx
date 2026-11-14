import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { toLocalInput } from "@/lib/time";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { EventForm } from "./event-form";

export const metadata = { title: "New event" };

async function NewEvent({ searchParams }: { searchParams: PageProps<"/events/new">["searchParams"] }) {
  const me = await requireMe();
  if (me.isSuspended || me.isCounselor) redirect("/events");
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { club } = await searchParams;
  const [{ data: led }, { data: council }, { data: people }] = await Promise.all([
    supabase.from("club_members").select("club:clubs(id, name, emoji, status)").eq("profile_id", me.id).eq("role", "leader"),
    supabase.rpc("can_post_council"),
    supabase.from("profiles").select("id, full_name").is("deactivated_at", null).not("onboarded_at", "is", null).neq("id", me.id).order("full_name").limit(500),
  ]);
  const clubs = (led ?? []).map((d) => d.club).filter((c) => c && c.status === "approved") as { id: string; name: string; emoji: string }[];
  // Admins, the Student Council and a club's leaders publish at once. Everyone else sends a proposal.
  const direct = me.isAdmin || !!council || clubs.length > 0;
  // Admins and the Council can publish for any club; club leaders for their own.
  const { data: every } = me.isAdmin || council ? await supabase.from("clubs").select("id, name, emoji").eq("status", "approved").order("name") : { data: null };
  const allClubs = every ?? clubs;
  const start = new Date();
  start.setDate(start.getDate() + 1);
  start.setMinutes(0, 0, 0);
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <p className="rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
        {me.isAdmin || council ? t("You can publish events straight away.") : clubs.length > 0 ? t("You can publish events for your clubs straight away. Other events are sent to an admin first.") : t("Anyone can suggest an event. An admin approves it before it shows on the calendar.")}
      </p>
      <EventForm
        schoolId={me.school_id} userId={me.id} locale={locale} minStart={toLocalInput(new Date())} direct={direct}
        clubs={allClubs} canSetTeam={false} people={(people ?? []).map((p) => ({ id: p.id, name: p.full_name }))}
        draft={{
          title: "", description: "", location: "", category: "social", starts_at: toLocalInput(start), ends_at: "",
          club_id: typeof club === "string" && clubs.some((c) => c.id === club) ? club : "", capacity: null, cover_path: null, organizers: [],
        }}
      />
    </div>
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
