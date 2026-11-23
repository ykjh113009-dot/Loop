"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { closePoll, editContent, hideContent, purgeContent } from "@/app/actions/admin-content";
import type { ActionResult } from "@/lib/errors";
import type { ContentKind } from "@/lib/content-powers";

const TITLE_LABEL: Partial<Record<ContentKind, string>> = { listing: "Title", group: "Name", club: "Name", event: "Title", poll: "Question", challenge: "Title", volunteering: "Title", announcement: "Title", council: "Title" };

type Props = {
  kind: ContentKind;
  id: string;
  title?: string | null;
  detail?: string | null;
  canHide: boolean;
  canEdit: boolean;
  canDelete: boolean;
  /** Where to go after the item is hidden or deleted (it is no longer visible where the person stands). */
  next: string;
  compact?: boolean;
  /** A poll that is still open can be closed early. */
  closable?: boolean;
};

function useDone(state: ActionResult, to?: string) {
  const router = useRouter();
  useEffect(() => {
    if (!state?.ok) return;
    if (to) router.push(to); else router.refresh();
  }, [state, to, router]);
}

// Inline staff controls on the page where something lives, so nobody has to leave Marketplace, the Library, the community or
// School Life to look after it. Hide keeps the item and can be undone from Admin > Content > Recently removed.
export function AdminControls({ kind, id, title, detail, canHide, canEdit, canDelete, next, compact, closable }: Props) {
  const [edited, edit] = useActionState(editContent, null);
  const [hidden, hide] = useActionState(hideContent, null);
  const [deleted, purge] = useActionState(purgeContent, null);
  const [closed, close] = useActionState(closePoll, null);
  useDone(closed);
  useDone(edited);
  if (!canHide && !canEdit && !canDelete) return null;
  const msg = [edited, hidden, deleted, closed].find((s) => s?.error);
  return (
    <details className="relative inline-block text-sm" data-admin-controls={kind}>
      <summary className={`inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-brand-700/20 bg-white/80 font-medium text-brand-800 hover:bg-brand-50 [&::-webkit-details-marker]:hidden ${compact ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5"}`}>
        <ShieldCheck className="size-4" aria-hidden="true" />Manage
      </summary>
      <div className="absolute end-0 z-20 mt-2 w-[min(22rem,88vw)] space-y-3 rounded-2xl border border-brand-700/10 bg-white p-3 text-start shadow-lg">
        {canEdit && (
          <form action={edit} className="space-y-2">
            <p className="text-xs font-semibold text-black/55">Edit</p>
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={id} />
            {TITLE_LABEL[kind] ? <input name="title" required defaultValue={title ?? ""} aria-label={TITLE_LABEL[kind]} className="input" /> : <input type="hidden" name="title" value="" />}
            {kind !== "poll" && <textarea name="detail" rows={3} defaultValue={detail ?? ""} aria-label="Text" className="input" />}
            <button className="btn-primary px-3.5 py-1.5 text-sm">Save changes</button>
          </form>
        )}
        {canEdit && closable && (
          <form action={close} className="border-t border-black/5 pt-3">
            <input type="hidden" name="id" value={id} />
            <button className="btn-secondary px-3.5 py-1.5 text-sm">Close this poll now</button>
          </form>
        )}
        {canHide && (
          <form action={hide} className="space-y-2 border-t border-black/5 pt-3">
            <p className="text-xs font-semibold text-black/55">Hide (can be restored)</p>
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={id} />
            <input name="reason" required minLength={3} maxLength={300} placeholder="Why? (the person is told)" aria-label="Reason for hiding" className="input" />
            <button className="btn-danger px-3.5 py-1.5 text-sm">Hide</button>
          </form>
        )}
        {canDelete && (
          <form action={purge} className="space-y-2 border-t border-black/5 pt-3">
            <p className="text-xs font-semibold text-red-800">Delete for good (cannot be undone)</p>
            <input type="hidden" name="next" value={next} />
            <input type="hidden" name="kind" value={kind} />
            <input type="hidden" name="id" value={id} />
            <input name="reason" required minLength={3} maxLength={300} placeholder="Reason" aria-label="Reason for deleting" className="input" />
            <input name="confirm" required pattern="DELETE" placeholder="Type DELETE to confirm" aria-label="Type DELETE to confirm" autoComplete="off" className="input" />
            <button className="btn-danger px-3.5 py-1.5 text-sm">Delete for good</button>
          </form>
        )}
        {msg?.error && <p role="alert" className="text-xs text-red-700">{msg.error}</p>}
      </div>
    </details>
  );
}
