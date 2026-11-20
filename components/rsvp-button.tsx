"use client";

import { useActionState } from "react";
import { joinEvent, leaveEvent } from "@/app/actions/events";
import { makeT, type Locale } from "@/lib/i18n";

// "I'm going" with a live-enough count. Full events put students on a waiting list.
export function RsvpButton({ eventId, status, goingCount, capacity, disabledReason, locale }: {
  eventId: string; status: "going" | "waitlist" | null; goingCount: number; capacity: number | null; disabledReason?: string; locale: Locale;
}) {
  const t = makeT(locale);
  const [joinState, join, joining] = useActionState(joinEvent, null);
  const [leaveState, leave, leaving] = useActionState(leaveEvent, null);
  const busy = joining || leaving;
  const full = capacity !== null && goingCount >= capacity;
  const message = joinState?.message ?? joinState?.error ?? leaveState?.error;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <div className="text-center">
          <p className="text-2xl leading-none font-bold">{goingCount}{capacity !== null && <span className="text-sm font-medium text-black/45">/{capacity}</span>}</p>
          <p className="text-xs text-black/50">{t("going")}</p>
        </div>
        {disabledReason ? (
          <p className="flex-1 text-sm text-black/50">{disabledReason}</p>
        ) : status ? (
          <form action={leave} className="flex-1">
            <input type="hidden" name="id" value={eventId} />
            <button disabled={busy} className="btn-secondary w-full py-3">
              {busy ? "…" : status === "going" ? t("You're going · Cancel") : t("On the waiting list · Leave")}
            </button>
          </form>
        ) : (
          <form action={join} className="flex-1">
            <input type="hidden" name="id" value={eventId} />
            <button disabled={busy} className="btn-primary w-full py-3">{busy ? "…" : full ? t("Join the waiting list") : t("I'm going")}</button>
          </form>
        )}
      </div>
      {message && <p role="status" className={`text-sm ${joinState?.error || leaveState?.error ? "text-red-700" : "text-brand-800"}`}>{message}</p>}
    </div>
  );
}
