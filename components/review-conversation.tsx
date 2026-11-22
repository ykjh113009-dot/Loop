"use client";

import { useState, useTransition } from "react";
import { ShieldAlert } from "lucide-react";
import { openReportedConversation, type ConversationLine } from "@/app/actions/admin-content";

// Private chats are not browsable. A Super Admin can read the messages around one reported message after giving a reason,
// and the opening is recorded in the activity log.
export function ReviewConversation({ reportId }: { reportId: string }) {
  const [pending, start] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lines, setLines] = useState<ConversationLine[] | null>(null);
  return (
    <details className="rounded-xl border border-purple-200 bg-purple-50/50 px-3 py-2" data-review-conversation>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium text-purple-900 [&::-webkit-details-marker]:hidden"><ShieldAlert className="size-4" aria-hidden="true" />Read the conversation around it (Super Admin, recorded)</summary>
      {lines ? (
        <ol className="mt-2 space-y-1.5 text-sm" aria-label="Conversation around the reported message">
          {lines.map((l) => (
            <li key={l.id} className={`rounded-lg px-3 py-1.5 ${l.reported ? "bg-red-50 ring-1 ring-red-200" : "bg-white"}`}>
              <span className="font-semibold">{l.sender ?? "Unknown"}</span> <span className="text-xs text-black/45">{new Date(l.created_at).toLocaleString()}</span>
              <p className="whitespace-pre-wrap">{l.body || "(attachment)"}</p>
            </li>
          ))}
        </ol>
      ) : (
        <form
          className="mt-2 flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              setError(null);
              const r = await openReportedConversation(reportId, reason);
              if (r.error) setError(r.error); else setLines(r.lines ?? []);
            });
          }}
        >
          <input value={reason} onChange={(e) => setReason(e.target.value)} required minLength={10} maxLength={300} placeholder="Why do you need to read it? (recorded, at least 10 characters)" aria-label="Reason for reading the conversation" className="input flex-1" />
          <button className="btn-secondary px-3 py-2" disabled={pending || reason.trim().length < 10}>{pending ? "Opening…" : "Open"}</button>
        </form>
      )}
      {error && <p role="alert" className="mt-1 text-xs text-red-700">{error}</p>}
    </details>
  );
}
