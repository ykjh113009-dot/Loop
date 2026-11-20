import { ClubMark } from "@/components/club-mark";
import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { signImages } from "@/lib/images";
import { eventCategory } from "@/lib/events";
import { formatDate, formatTime, timeAgo, toLocalInput } from "@/lib/time";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { ReportButton } from "@/components/report-button";
import { RsvpButton } from "@/components/rsvp-button";
import { PageSkeleton } from "@/components/skeleton";
import { ApplyForm, WithdrawButton } from "../../volunteering/volunteer-forms";
import { ManageEvent } from "./manage-event";
import { AttendeeActions, PostUpdateForm, ProposalDecision } from "./organizer-tools";

async function EventDetails({ params }: { params: PageProps<"/events/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data: event } = await supabase
    .from("events")
    .select("*, club:clubs(id, name, emoji, image_path), creator:profiles!events_created_by_fkey(id, full_name)")
    .eq("id", id)
    .maybeSingle();
  if (!event) notFound();

  const [{ data: rsvps }, { data: canManageRow }, { data: team }, { data: updates }, { data: files }, { data: chat }, { data: roles }] = await Promise.all([
    supabase.from("event_rsvps").select("profile_id, status, created_at, profile:profiles(id, full_name, avatar)").eq("event_id", id).order("created_at").limit(400),
    supabase.rpc("can_manage_event_id", { p_event: id }),
    supabase.from("event_organizers").select("profile:profiles(id, full_name)").eq("event_id", id),
    supabase.from("event_updates").select("id, kind, title, body, created_at").eq("event_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("event_attachments").select("id, name, kind, path").eq("event_id", id).order("created_at"),
    supabase.from("conversations").select("id").eq("event_id", id).maybeSingle(),
    supabase.from("volunteer_opportunities").select("id, title, description, requirements, spots, status, created_by").eq("event_id", id).neq("status", "cancelled"),
  ]);
  const everyone = rsvps ?? [];
  const goingList = everyone.filter((r) => r.status === "going");
  const waitList = everyone.filter((r) => r.status === "waitlist");
  const myRsvp = everyone.find((r) => r.profile_id === me.id)?.status as "going" | "waitlist" | undefined;

  const oppIds = (roles ?? []).map((r) => r.id);
  const { data: myApps } = oppIds.length ? await supabase.from("volunteer_applications").select("id, opportunity_id, status, responsibility").eq("profile_id", me.id).in("opportunity_id", oppIds) : { data: [] };
  const [covers, fileUrls] = await Promise.all([
    signImages(supabase, [event.cover_path]),
    (files ?? []).length ? supabase.storage.from("event-files").createSignedUrls((files ?? []).map((f) => f.path), 3600) : Promise.resolve({ data: [] }),
  ]);
  const urlOf = new Map((fileUrls.data ?? []).filter((d) => d.path && d.signedUrl).map((d) => [d.path!, d.signedUrl!] as const));

  const now = new Date();
  const over = (event.ends_at ? new Date(event.ends_at) : new Date(new Date(event.starts_at).getTime() + 3 * 3600 * 1000)) <= now;
  const started = new Date(event.starts_at) <= now;
  const open = event.status === "approved" || event.status === "pending";
  const canManage = !!canManageRow && open && !over && !me.isSuspended;
  const cat = eventCategory(event.category);
  const disabledReason =
    event.status === "cancelled" ? t("This event was cancelled.")
    : event.status === "pending" ? t("You can say you're going once an admin approves this event.")
    : event.status === "rejected" ? t("This event was not approved.")
    : over ? t("This event is over.")
    : me.isSuspended ? t("You can't RSVP while suspended.")
    : undefined;
  const organizers = [event.creator, ...(team ?? []).map((m) => m.profile)].filter((p): p is { id: string; full_name: string } => !!p);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={event.title} back="/events" action={<ReportButton targetType="event" targetId={event.id} compact />} />

      {event.status === "cancelled" && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800"><strong>{t("Cancelled.")}</strong> {event.cancel_reason}</p>
      )}
      {event.status === "pending" && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{t("Waiting for an admin to approve this event.")}</p>
      )}
      {event.status === "pending" && me.isAdmin && (
        <div className="card p-4"><ProposalDecision eventId={event.id} locale={locale} /></div>
      )}

      <article className="card overflow-hidden">
        {event.cover_path && covers.get(event.cover_path) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={covers.get(event.cover_path)!} alt="" className="h-44 w-full object-cover" />
        )}
        <div className="space-y-3 p-4">
          <p className="flex items-center gap-2 text-sm">
            <span className="chip bg-brand-50 text-brand-800">{cat.emoji} {t(cat.label)}</span>
            {started && !over && event.status === "approved" && <span className="chip bg-amber-50 text-amber-800">{t("Happening now")}</span>}
          </p>
          <p className="flex items-center gap-2 text-sm"><Icon name="calendar" className="size-4 text-brand-700" /><span className="font-medium">{formatDate(event.starts_at)}</span></p>
          <p className="flex items-center gap-2 text-sm"><Icon name="clock" className="size-4 text-brand-700" />{formatTime(event.starts_at)}{event.ends_at && ` – ${formatTime(event.ends_at)}`}</p>
          {event.location && <p className="flex items-center gap-2 text-sm"><Icon name="pin" className="size-4 text-brand-700" /> {event.location}</p>}
          <p className="text-sm text-black/55">
            {event.club ? <Link href={`/clubs/${event.club.id}`} className="text-brand-700 hover:underline"><ClubMark club={event.club} className="size-5" /> {event.club.name}</Link> : <>🏫 {t("Whole school")}</>}
          </p>
          {organizers.length > 0 && (
            <p className="text-sm text-black/60">
              <strong className="text-black/75">{t("Organizers")}:</strong>{" "}
              {organizers.map((o, i) => <span key={o.id}>{i > 0 && ", "}<Link href={`/profile/${o.id}`} className="hover:underline">{o.full_name}</Link></span>)}
            </p>
          )}
          {event.description && <p className="border-t border-black/5 pt-3 whitespace-pre-wrap">{event.description}</p>}
        </div>
      </article>

      <div className="card space-y-4 p-4">
        <RsvpButton eventId={event.id} status={myRsvp ?? null} goingCount={goingList.length} capacity={event.capacity} disabledReason={disabledReason} locale={locale} />
        {goingList.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {goingList.slice(0, 24).map((r) => r.profile && (
              <Link key={r.profile.id} href={`/profile/${r.profile.id}`} title={r.profile.full_name}><Avatar avatar={r.profile.avatar} size="sm" /></Link>
            ))}
            {goingList.length > 24 && <span className="chip self-center">+{goingList.length - 24} {t("more")}</span>}
          </div>
        )}
        {waitList.length > 0 && <p className="text-sm text-black/55">{t("{n} on the waiting list", { n: waitList.length })}</p>}
        {open && !over && <p className="text-xs text-black/45">{t("Coming is always optional. If you say you're going, we'll remind you a day and an hour before.")}</p>}
        {chat && (myRsvp === "going" || canManageRow) && (
          <Link href={`/messages/${chat.id}`} className="btn-secondary w-full">💬 {t("Open the event chat")}</Link>
        )}
      </div>

      {(updates ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">{t("Updates")}</h2>
          {(updates ?? []).map((u) => (
            <article key={u.id} className="card p-4 text-sm">
              <p className="font-semibold">{u.kind === "change" ? "✏️" : "📣"} {u.title} <span className="text-xs font-normal text-black/45">· {timeAgo(u.created_at)}</span></p>
              {u.body && <p className="mt-1 whitespace-pre-wrap text-black/70">{u.body}</p>}
            </article>
          ))}
        </section>
      )}

      {(files ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">{t("Photos and documents")}</h2>
          <div className="card divide-y divide-black/5">
            {(files ?? []).map((f) => (
              <a key={f.id} href={urlOf.get(f.path)} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 text-sm hover:bg-black/[0.02]">
                {f.kind === "image" && urlOf.get(f.path) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urlOf.get(f.path)} alt="" loading="lazy" className="size-12 rounded-lg object-cover" />
                ) : <span className="text-2xl">📄</span>}
                <span className="min-w-0 flex-1 truncate text-brand-700">{f.name}</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {(roles ?? []).length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">💚 {t("Volunteer for this event")}</h2>
          {(roles ?? []).map((o) => {
            const app = (myApps ?? []).find((a) => a.opportunity_id === o.id);
            const active = app && app.status !== "withdrawn";
            return (
              <article key={o.id} className="card space-y-2 p-4 text-sm">
                <p className="font-semibold">{o.title}{o.spots && <span className="chip ms-2 bg-black/5">{t("{n} spots", { n: o.spots })}</span>}</p>
                {o.description && <p className="whitespace-pre-wrap text-black/70">{o.description}</p>}
                {o.requirements && <p className="text-black/60"><strong>{t("Needed")}:</strong> {o.requirements}</p>}
                {active ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="chip bg-brand-50 text-brand-800">{app.status === "accepted" ? `✅ ${t("You are in")}` : app.status === "completed" ? `💚 ${t("Done")}` : app.status === "rejected" ? t("Not this time") : `⏳ ${t("Waiting")}`}</span>
                    {(app.status === "pending" || app.status === "accepted") && <WithdrawButton id={app.id} locale={locale} />}
                  </div>
                ) : o.status === "open" && me.isStudent && o.created_by !== me.id && event.status === "approved" && !over ? (
                  <ApplyForm id={o.id} locale={locale} />
                ) : o.status !== "open" ? <p className="text-black/50">{t("Applications are closed.")}</p> : null}
                {active && app.status === "accepted" && app.responsibility && <p className="rounded-xl bg-brand-50 p-3 text-brand-900"><strong>{t("Your role")}:</strong> {app.responsibility}</p>}
                {canManage && <Link href={`/volunteering/manage/${o.id}`} className="text-brand-700 underline">{t("Manage volunteers")}</Link>}
              </article>
            );
          })}
        </section>
      )}

      {canManage && (
        <section className="space-y-3">
          <h2 className="section-title">{t("For the organizers")}</h2>
          <div className="flex flex-wrap gap-2">
            <Link href={`/events/${event.id}/edit`} className="btn-primary">✏️ {t("Edit event")}</Link>
            {event.status === "approved" && <Link href={`/volunteering/new?event=${event.id}`} className="btn-secondary">💚 {t("Add a volunteer role")}</Link>}
          </div>
          {event.status === "approved" && (
            <div className="card space-y-3 p-4"><h3 className="font-semibold">{t("Post an update")}</h3><PostUpdateForm eventId={event.id} locale={locale} /></div>
          )}
          {everyone.length > 0 && (
            <div className="card p-4">
              <h3 className="mb-2 font-semibold">{t("Who is coming")} ({goingList.length}{event.capacity ? `/${event.capacity}` : ""}{waitList.length > 0 && ` + ${waitList.length} ${t("waiting")}`})</h3>
              <ul className="divide-y divide-black/5 text-sm">
                {[...goingList, ...waitList].map((r) => r.profile && (
                  <li key={r.profile_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{r.profile.full_name} {r.status === "waitlist" && <span className="chip bg-amber-50 text-amber-800">{t("waiting")}</span>}</span>
                    <AttendeeActions eventId={event.id} profileId={r.profile_id} status={r.status} locale={locale} />
                  </li>
                ))}
              </ul>
            </div>
          )}
          <ManageEvent eventId={event.id} startsAt={toLocalInput(event.starts_at)} endsAt={event.ends_at ? toLocalInput(event.ends_at) : ""} minStart={toLocalInput(now)} />
        </section>
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
