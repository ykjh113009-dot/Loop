"use client";

import { useRef, useState, useTransition } from "react";
import { sendReport } from "@/app/actions/content";
import { Icon } from "@/components/icons";
import type { ActionResult } from "@/lib/errors";

const REASONS = [
  { value: "bullying", label: "Bullying or being mean" },
  { value: "harassment", label: "Harassment or unwanted messages" },
  { value: "inappropriate", label: "Rude or inappropriate" },
  { value: "spam", label: "Spam or off-topic" },
  { value: "self_harm", label: "Someone may need help (urgent)" },
  { value: "other", label: "Something else" },
];

const NAMES = { post: "post", message: "message", profile: "student", club: "club", event: "event" };

// The "Report" button that appears on every post, message, profile, club and event.
export function ReportButton({
  targetType,
  targetId,
  compact = false,
}: {
  targetType: keyof typeof NAMES;
  targetId: string;
  compact?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState<ActionResult>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    startTransition(async () => {
      setResult(
        await sendReport({
          targetType,
          targetId,
          reason: String(formData.get("reason") ?? ""),
          details: String(formData.get("details") ?? ""),
        }),
      );
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setResult(null);
          dialog.current?.showModal();
        }}
        className={compact ? "p-1 text-black/35 hover:text-red-600" : "btn-ghost px-2 py-1 text-xs text-black/50"}
        aria-label={`Report this ${NAMES[targetType]}`}
      >
        <Icon name="flag" className="size-4" />
        {!compact && "Report"}
      </button>
      <dialog
        ref={dialog}
        className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl p-0 backdrop:bg-black/40"
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
      >
        <div className="p-5">
          <h2 className="text-lg font-bold">Report this {NAMES[targetType]}</h2>
          {result?.message ? (
            <>
              <p className="mt-3 text-sm text-black/70">{result.message}</p>
              <button className="btn-primary mt-4 w-full" onClick={() => dialog.current?.close()}>
                Done
              </button>
            </>
          ) : (
            <form action={submit} className="mt-3 space-y-3">
              <div className="space-y-1.5">
                {REASONS.map((r) => (
                  <label key={r.value} className="flex items-center gap-3 rounded-xl border border-black/10 px-3 py-2 text-sm has-checked:border-brand-600 has-checked:bg-brand-50">
                    <input type="radio" name="reason" value={r.value} required className="accent-brand-700" />
                    {r.label}
                  </label>
                ))}
              </div>
              <textarea name="details" rows={2} maxLength={1000} placeholder="Anything else we should know? (optional)" className="input resize-none text-sm" />
              {result?.error && <p className="text-sm text-red-700">{result.error}</p>}
              <div className="flex gap-2">
                <button type="button" className="btn-secondary flex-1" onClick={() => dialog.current?.close()}>
                  Cancel
                </button>
                <button className="btn-danger flex-1" disabled={pending}>
                  {pending ? "Sending…" : "Send report"}
                </button>
              </div>
            </form>
          )}
        </div>
      </dialog>
    </>
  );
}
