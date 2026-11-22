import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { closePoll, editContent, hideContent, purgeContent, restoreContent } from "@/app/actions/admin-content";
import { ActionForm } from "@/components/action-form";
import { AdminNav } from "@/components/admin-nav";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";
import { Empty } from "@/components/empty";

export const metadata = { title: "Content" };

const KINDS = [
  { id: "all", label: "Everything" },
  { id: "post", label: "Posts" },
  { id: "comment", label: "Comments" },
  { id: "message", label: "Group chats" },
  { id: "club", label: "Clubs" },
  { id: "group", label: "Groups" },
  { id: "listing", label: "Marketplace" },
  { id: "event", label: "Events" },
  { id: "poll", label: "Polls" },
  { id: "resource", label: "Library" },
] as const;
const LABEL: Record<string, string> = { post: "Post", comment: "Comment", message: "Group chat message", club: "Club", group: "Group", listing: "Marketplace", event: "Event", poll: "Poll", resource: "Library" };
const OPEN: Record<string, (id: string) => string> = {
  post: (id) => `/post/${id}`, club: (id) => `/clubs/${id}`, group: (id) => `/groups/${id}`, listing: (id) => `/market/${id}`,
  event: (id) => `/events/${id}`, resource: (id) => `/academic-resources/resource/${id}`,
};
// What each kind's "title" field means when editing (posts and comments have only text).
const TITLE_LABEL: Record<string, string> = { listing: "Title", group: "Name", club: "Name", event: "Title", poll: "Question" };
const NO_STATUS_CHIP = new Set(["visible", "approved", "active", "open"]);

const linkTo = (kind: string, view: string) => {
  const q = new URLSearchParams();
  if (kind !== "all") q.set("kind", kind);
  if (view === "removed") q.set("view", "removed");
  const s = q.toString();
  return s ? `/admin/content?${s}` : "/admin/content";
};

async function Feed({ searchParams }: { searchParams: PageProps<"/admin/content">["searchParams"] }) {
  const me = await requireMe("staff");
  const sp = await searchParams;
  const kind = KINDS.find((k) => k.id === sp.kind)?.id ?? "all";
  const view = sp.view === "removed" ? "removed" : "active";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_content_list", { p_kind: kind, p_view: view, p_limit: 80 });
  const rows = data ?? [];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Active or removed" className="flex gap-1 rounded-xl bg-black/5 p-1">
          {([["active", "Active"], ["removed", "Recently removed"]] as const).map(([v, l]) => (
            <Link key={v} href={linkTo(kind, v)} aria-current={view === v ? "page" : undefined} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${view === v ? "bg-brand-700 text-white shadow-sm" : "text-black/55 hover:bg-sage-soft/60"}`}>{l}</Link>
          ))}
        </nav>
        <nav aria-label="Kinds of content" className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <Link key={k.id} href={linkTo(k.id, view)} aria-current={kind === k.id ? "page" : undefined} className="chip px-3.5 py-1.5">{k.label}</Link>
          ))}
        </nav>
      </div>
      <p className="text-xs text-black/50">
        {view === "active"
          ? "The newest things people made on Loop. Hiding something keeps it, takes it off Loop for students and tells the person why. You can restore it any time from Recently removed."
          : "Hidden by staff. Restore puts it back exactly as it was."}
        {me.isSuperAdmin ? " Only a Super Admin can delete for good, and only what was hidden first." : ""} Every step is written to the activity log. Private one-to-one messages are never listed here.
      </p>
      {error && <p role="alert" className="text-sm text-red-700">The list could not be loaded.</p>}
      {!error && rows.length === 0 && <Empty emoji="✓" title="Nothing here">{view === "active" ? "Nothing has been posted in this section yet." : "Nothing has been removed."}</Empty>}
      {rows.map((r) => (
        <article key={`${r.kind}-${r.id}`} className="card p-4" data-content-row={r.kind}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-black/50">
            <span className="chip bg-sage-soft/60 text-brand-800">{LABEL[r.kind] ?? r.kind}</span>
            {r.status && !NO_STATUS_CHIP.has(r.status) && <span className="chip bg-amber-50 text-amber-900">{r.status}</span>}
            <span>{r.author ?? "Unknown"} · {formatDateTime(r.created_at)}</span>
          </div>
          <div className="mt-1 min-w-0">
            <p className="font-semibold break-words">{r.title || "(no title)"}</p>
            {r.detail && r.detail !== r.title && <p className="mt-0.5 text-sm break-words whitespace-pre-wrap text-black/65">{r.detail}</p>}
            {OPEN[r.kind] && view === "active" && <Link href={OPEN[r.kind](r.id)} className="mt-1 inline-block text-xs font-medium text-brand-700 hover:underline">Open</Link>}
          </div>
          {view === "removed" && r.hidden_at && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">Hidden by {r.hidden_by ?? "staff"} on {formatDateTime(r.hidden_at)}: {r.hidden_reason}</p>
          )}

          <div className="mt-3 flex flex-wrap items-start gap-2">
            {view === "active" && r.can_edit && r.kind !== "resource" && (
              <details className="w-full sm:w-auto">
                <summary className="inline-flex cursor-pointer list-none rounded-full border border-brand-700/20 px-3.5 py-1.5 text-sm font-medium text-brand-800 hover:bg-brand-50 [&::-webkit-details-marker]:hidden">Edit…</summary>
                <ActionForm action={editContent} className="mt-2 flex w-full flex-col gap-2 sm:min-w-[28rem]">
                  <input type="hidden" name="kind" value={r.kind} />
                  <input type="hidden" name="id" value={r.id} />
                  {TITLE_LABEL[r.kind] ? (
                    <input name="title" required defaultValue={r.title ?? ""} aria-label={TITLE_LABEL[r.kind]} className="input" />
                  ) : <input type="hidden" name="title" value="" />}
                  {r.kind !== "poll" && <textarea name="detail" rows={4} defaultValue={r.kind === "post" || r.kind === "comment" ? (r.detail ?? "") : (r.detail ?? "")} aria-label="Text" className="input" />}
                  <SubmitButton className="btn-primary self-start" pendingText="Saving…">Save changes</SubmitButton>
                </ActionForm>
              </details>
            )}
            {view === "active" && r.kind === "poll" && r.can_edit && r.status === "open" && (
              <ActionForm action={closePoll}>
                <input type="hidden" name="id" value={r.id} />
                <SubmitButton className="btn-secondary px-3.5 py-1.5 text-sm" pendingText="Closing…">Close poll</SubmitButton>
              </ActionForm>
            )}
            {view === "active" && r.can_hide && r.kind !== "poll" && (
              <details className="w-full sm:w-auto">
                <summary className="inline-flex cursor-pointer list-none rounded-full border border-red-200 px-3.5 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 [&::-webkit-details-marker]:hidden">Hide…</summary>
                <ActionForm action={hideContent} className="mt-2 flex flex-col gap-2 sm:flex-row">
                  <input type="hidden" name="kind" value={r.kind} />
                  <input type="hidden" name="id" value={r.id} />
                  <input name="reason" required minLength={3} maxLength={300} placeholder="Why is it being hidden? (the person is told)" aria-label="Reason for hiding" className="input flex-1" />
                  <SubmitButton className="btn-danger" pendingText="Hiding…">Hide</SubmitButton>
                </ActionForm>
              </details>
            )}
            {view === "removed" && r.can_hide && (
              <ActionForm action={restoreContent}>
                <input type="hidden" name="kind" value={r.kind} />
                <input type="hidden" name="id" value={r.id} />
                <SubmitButton className="btn-primary px-3.5 py-1.5 text-sm" pendingText="Restoring…">Restore</SubmitButton>
              </ActionForm>
            )}
            {((view === "removed" && r.can_purge) || (view === "active" && r.kind === "poll" && r.can_purge)) && (
              <details className="w-full sm:w-auto">
                <summary className="inline-flex cursor-pointer list-none rounded-full border border-red-300 px-3.5 py-1.5 text-sm font-medium text-red-800 hover:bg-red-50 [&::-webkit-details-marker]:hidden">Delete for good…</summary>
                <ActionForm action={purgeContent} className="mt-2 flex flex-col gap-2 sm:min-w-[28rem]">
                  <input type="hidden" name="kind" value={r.kind} />
                  <input type="hidden" name="id" value={r.id} />
                  <p className="text-xs text-red-800">This cannot be undone. A copy of the text is kept in the activity log.</p>
                  <input name="reason" required minLength={3} maxLength={300} placeholder="Reason" aria-label="Reason for deleting" className="input" />
                  <input name="confirm" required pattern="DELETE" placeholder="Type DELETE to confirm" aria-label="Type DELETE to confirm" autoComplete="off" className="input" />
                  <SubmitButton className="btn-danger self-start" pendingText="Deleting…">Delete for good</SubmitButton>
                </ActionForm>
              </details>
            )}
          </div>
        </article>
      ))}
    </div>
  );
}

export default function AdminContentPage(props: PageProps<"/admin/content">) {
  return (
    <>
      <PageHeader title="Content" />
      <Suspense fallback={null}><Nav /></Suspense>
      <Suspense fallback={<PageSkeleton />}>
        <Feed searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

// Moderators reach this page from the moderation page; the rest of the admin menu is for admins.
async function Nav() {
  const me = await requireMe("staff");
  return me.isAdmin ? <AdminNav current="/admin/content" /> : null;
}
