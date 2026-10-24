import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { deleteAnnouncement } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { AdminNav } from "@/components/admin-nav";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";
import { AnnouncementForm } from "./announcement-form";

export const metadata = { title: "Announcements" };

async function Announcements() {
  await requireMe("admin");
  const supabase = await createClient();
  const { data } = await supabase
    .from("announcements")
    .select("id, title, body, created_at, author:profiles(full_name)")
    .order("created_at", { ascending: false })
    .limit(30);
  return (
    <div className="space-y-3">
      <AnnouncementForm />
      <h2 className="section-title pt-2">Posted</h2>
      {(data ?? []).map((a) => (
        <article key={a.id} className="card p-4">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{a.title}</p>
              <p className="text-xs text-black/45">{formatDateTime(a.created_at)} · {a.author?.full_name}</p>
            </div>
            <ActionForm action={deleteAnnouncement}>
              <input type="hidden" name="id" value={a.id} />
              <SubmitButton className="text-xs text-black/40 hover:text-red-600" pendingText="…">Delete</SubmitButton>
            </ActionForm>
          </div>
          <p className="mt-2 text-sm whitespace-pre-wrap text-black/75">{a.body}</p>
        </article>
      ))}
    </div>
  );
}

export default function AdminAnnouncementsPage() {
  return (
    <>
      <PageHeader title="Announcements" />
      <AdminNav current="/admin/announcements" />
      <Suspense fallback={<PageSkeleton />}>
        <Announcements />
      </Suspense>
    </>
  );
}
