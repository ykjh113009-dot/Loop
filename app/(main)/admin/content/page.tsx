import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { removeContent } from "@/app/actions/admin-content";
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
  { id: "club", label: "Clubs" },
  { id: "group", label: "Groups" },
  { id: "listing", label: "Marketplace" },
  { id: "event", label: "Events" },
  { id: "poll", label: "Polls" },
  { id: "resource", label: "Library" },
] as const;
const LABEL: Record<string, string> = { post: "Post", comment: "Comment", club: "Club", group: "Group", listing: "Marketplace", event: "Event", poll: "Poll", resource: "Library" };
const OPEN: Record<string, (id: string) => string> = {
  post: (id) => `/post/${id}`, club: (id) => `/clubs/${id}`, group: (id) => `/groups/${id}`, listing: (id) => `/market/${id}`,
  event: (id) => `/events/${id}`, resource: (id) => `/academic-resources/resource/${id}`,
};

async function Feed({ searchParams }: { searchParams: PageProps<"/admin/content">["searchParams"] }) {
  await requireMe("admin");
  const sp = await searchParams;
  const kind = KINDS.find((k) => k.id === sp.kind)?.id ?? "all";
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_content_feed", { p_kind: kind, p_limit: 80 });
  const rows = data ?? [];
  return (
    <div className="space-y-3">
      <nav aria-label="Kinds of content" className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Link key={k.id} href={k.id === "all" ? "/admin/content" : `/admin/content?kind=${k.id}`} aria-current={kind === k.id ? "page" : undefined} className="chip px-3.5 py-1.5">{k.label}</Link>
        ))}
      </nav>
      <p className="text-xs text-black/50">The newest things people made on Loop, newest first. Removing something tells the person why and is written to the activity log. Removing a club, group or event also removes what belongs to it.</p>
      {error && <p role="alert" className="text-sm text-red-700">The list could not be loaded.</p>}
      {!error && rows.length === 0 && <Empty emoji="✓" title="Nothing here">Nothing has been posted in this section yet.</Empty>}
      {rows.map((r) => (
        <article key={`${r.kind}-${r.id}`} className="card p-4" data-content-row={r.kind}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-black/50">
            <span className="chip bg-sage-soft/60 text-brand-800">{LABEL[r.kind] ?? r.kind}</span>
            {r.status && r.status !== "visible" && r.status !== "approved" && r.status !== "active" && <span className="chip bg-amber-50 text-amber-900">{r.status}</span>}
            <span>{r.author ?? "Unknown"} · {formatDateTime(r.created_at)}</span>
          </div>
          <div className="mt-1 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold break-words">{r.title || "(no title)"}</p>
              {r.detail && r.detail !== r.title && <p className="mt-0.5 text-sm break-words whitespace-pre-wrap text-black/65">{r.detail}</p>}
              {OPEN[r.kind] && <Link href={OPEN[r.kind](r.id)} className="mt-1 inline-block text-xs font-medium text-brand-700 hover:underline">Open</Link>}
            </div>
          </div>
          <details className="mt-3">
            <summary className="inline-flex cursor-pointer list-none rounded-full border border-red-200 px-3.5 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 [&::-webkit-details-marker]:hidden">Remove…</summary>
            <ActionForm action={removeContent} className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="kind" value={r.kind} />
              <input type="hidden" name="id" value={r.id} />
              <input name="reason" required minLength={3} maxLength={300} placeholder="Why is it being removed? (the person is told)" aria-label="Reason for removing" className="input flex-1" />
              <SubmitButton className="btn-danger" pendingText="Removing…">Remove for good</SubmitButton>
            </ActionForm>
          </details>
        </article>
      ))}
    </div>
  );
}

export default function AdminContentPage(props: PageProps<"/admin/content">) {
  return (
    <>
      <PageHeader title="Content" />
      <AdminNav current="/admin/content" />
      <Suspense fallback={<PageSkeleton />}>
        <Feed searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
