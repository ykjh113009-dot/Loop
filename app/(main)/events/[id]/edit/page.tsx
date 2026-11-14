import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { toLocalInput } from "@/lib/time";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { EventForm } from "../../new/event-form";
import { AttachmentUploader, RemoveAttachment } from "../../attachments";

export const metadata = { title: "Edit event" };

async function Edit({ params }: { params: PageProps<"/events/[id]/edit">["params"] }) {
  const { id } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data: e } = await supabase.from("events").select("*").eq("id", id).maybeSingle();
  if (!e) notFound();
  const { data: canManage } = await supabase.rpc("can_manage_event_id", { p_event: id });
  if (!canManage || (e.status !== "approved" && e.status !== "pending")) redirect(`/events/${id}`);
  const [{ data: team }, { data: files }, { data: people }, { data: leader }] = await Promise.all([
    supabase.from("event_organizers").select("profile_id").eq("event_id", id),
    supabase.from("event_attachments").select("id, name, kind, path").eq("event_id", id).order("created_at"),
    supabase.from("profiles").select("id, full_name").is("deactivated_at", null).not("onboarded_at", "is", null).neq("id", e.created_by ?? me.id).order("full_name").limit(500),
    e.club_id ? supabase.from("club_members").select("role").eq("club_id", e.club_id).eq("profile_id", me.id).eq("role", "leader").maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const canSetTeam = e.created_by === me.id || me.isAdmin || !!leader;
  const signed = new Map<string, string>();
  if ((files ?? []).length) {
    const { data } = await supabase.storage.from("event-files").createSignedUrls((files ?? []).map((f) => f.path), 3600);
    for (const d of data ?? []) if (d.path && d.signedUrl) signed.set(d.path, d.signedUrl);
  }
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <EventForm
        schoolId={me.school_id} userId={me.id} locale={locale} minStart="" direct canSetTeam={canSetTeam} clubs={[]}
        people={(people ?? []).map((p) => ({ id: p.id, name: p.full_name }))}
        draft={{
          id: e.id, title: e.title, description: e.description, location: e.location, category: e.category, club_id: e.club_id ?? "",
          starts_at: toLocalInput(e.starts_at), ends_at: e.ends_at ? toLocalInput(e.ends_at) : "", capacity: e.capacity,
          cover_path: e.cover_path, organizers: (team ?? []).map((m) => m.profile_id),
        }}
      />
      <section className="card space-y-3 p-4">
        <h2 className="section-title">{t("Photos and documents")}</h2>
        <ul className="divide-y divide-black/5 text-sm">
          {(files ?? []).map((f) => (
            <li key={f.id} className="flex items-center gap-2 py-2">
              <span>{f.kind === "pdf" ? "📄" : "🖼️"}</span>
              <a href={signed.get(f.path)} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-brand-700 underline">{f.name}</a>
              <RemoveAttachment id={f.id} label={t("Remove")} />
            </li>
          ))}
          {(files ?? []).length === 0 && <li className="py-2 text-black/50">{t("No files yet.")}</li>}
        </ul>
        {(files ?? []).length < 6 && <AttachmentUploader eventId={e.id} schoolId={me.school_id} locale={locale} />}
      </section>
      <Link href={`/events/${id}`} className="btn-ghost w-full">{t("Back to the event")}</Link>
    </div>
  );
}

export default function EditEventPage(props: PageProps<"/events/[id]/edit">) {
  return (
    <>
      <PageHeader title="Edit event" back="/events" />
      <Suspense fallback={<PageSkeleton />}><Edit params={props.params} /></Suspense>
    </>
  );
}
