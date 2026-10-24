import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatTime, toLocalInput } from "@/lib/time";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { ReportButton } from "@/components/report-button";
import { RsvpButton } from "@/components/rsvp-button";
import { PageSkeleton } from "@/components/skeleton";
import { ManageEvent } from "./manage-event";

async function EventDetails({ params }: { params: PageProps<"/events/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select("*, club:clubs(id, name, emoji), creator:profiles!events_created_by_fkey(id, full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const [{ data: rsvps, count }, { data: mine }, { data: leader }] = await Promise.all([
    supabase
      .from("event_rsvps")
      .select("profile:profiles(id, full_name, avatar)", { count: "exact" })
      .eq("event_id", event.id)
      .order("created_at")
      .limit(24),
    supabase.from("event_rsvps").select("event_id").eq("event_id", event.id).eq("profile_id", me.id).maybeSingle(),
    event.club_id
      ? supabase.from("club_members").select("role").eq("club_id", event.club_id).eq("profile_id", me.id).eq("role", "leader").maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const going = !!mine;

  const now = new Date();
  const past = new Date(event.starts_at) <= now;
  const open = event.status === "approved" || event.status === "pending";
  const canManage = open && !past && !me.isSuspended && (me.isStaff || event.created_by === me.id || !!leader);
  const disabledReason =
    event.status === "cancelled" ? "This event was cancelled."
    : event.status === "pending" ? "You can RSVP once a moderator approves this event."
    : event.status === "rejected" ? "This event was not approved."
    : past ? "This event has already started."
    : me.isSuspended ? "You can't RSVP while suspended."
    : undefined;

  return (
    <div className="space-y-4">
      <PageHeader title={event.title} back="/events" action={<ReportButton targetType="event" targetId={event.id} compact />} />

      {event.status === "cancelled" && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          <strong>Cancelled.</strong> {event.cancel_reason}
        </p>
      )}
      {event.status === "pending" && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Waiting for a moderator to approve this event.</p>
      )}

      <div className="card space-y-3 p-4">
        <p className="flex items-center gap-2 text-sm">
          <Icon name="calendar" className="size-4 text-brand-700" />
          <span className="font-medium">{formatDate(event.starts_at)}</span>
        </p>
        <p className="flex items-center gap-2 text-sm">
          <Icon name="clock" className="size-4 text-brand-700" />
          {formatTime(event.starts_at)}{event.ends_at && ` – ${formatTime(event.ends_at)}`}
        </p>
        {event.location && (
          <p className="flex items-center gap-2 text-sm">
            <Icon name="pin" className="size-4 text-brand-700" /> {event.location}
          </p>
        )}
        <p className="text-sm text-black/55">
          {event.club ? (
            <Link href={`/clubs/${event.club.id}`} className="text-brand-700 hover:underline">{event.club.emoji} {event.club.name}</Link>
          ) : "🏫 Whole school"}
          {event.creator && <> · added by {event.creator.full_name}</>}
        </p>
        {event.description && <p className="border-t border-black/5 pt-3 whitespace-pre-wrap">{event.description}</p>}
      </div>

      <div className="card p-4">
        <RsvpButton eventId={event.id} meId={me.id} schoolId={me.school_id} initialGoing={going} initialCount={count ?? 0} disabledReason={disabledReason} />
        {(rsvps ?? []).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {(rsvps ?? []).map((r) =>
              r.profile ? (
                <Link key={r.profile.id} href={`/profile/${r.profile.id}`} title={r.profile.full_name}>
                  <Avatar avatar={r.profile.avatar} size="sm" />
                </Link>
              ) : null,
            )}
            {(count ?? 0) > 24 && <span className="chip self-center">+{(count ?? 0) - 24} more</span>}
          </div>
        )}
        {open && !past && <p className="mt-3 text-xs text-black/45">If you&apos;re going, we&apos;ll remind you a day and an hour before.</p>}
      </div>

      {canManage && (
        <ManageEvent
          eventId={event.id}
          startsAt={toLocalInput(event.starts_at)}
          endsAt={event.ends_at ? toLocalInput(event.ends_at) : ""}
          minStart={toLocalInput(now)}
        />
      )}
    </div>
  );
}

export default function EventPage(props: PageProps<"/events/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EventDetails params={props.params} />
    </Suspense>
  );
}
