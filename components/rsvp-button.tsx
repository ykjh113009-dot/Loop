"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// "I'm going" button with a going-count that updates live for everyone.
export function RsvpButton({
  eventId,
  meId,
  schoolId,
  initialGoing,
  initialCount,
  disabledReason,
}: {
  eventId: string;
  meId: string;
  schoolId: string;
  initialGoing: boolean;
  initialCount: number;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [going, setGoing] = useState(initialGoing);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recount = useCallback(async () => {
    const { count } = await createClient()
      .from("event_rsvps")
      .select("profile_id", { count: "exact", head: true })
      .eq("event_id", eventId);
    if (count !== null) setCount(count);
  }, [eventId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`rsvps:${eventId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "event_rsvps", filter: `event_id=eq.${eventId}` }, recount)
      // Deletes can't be filtered on the server, so check which event it was.
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "event_rsvps" }, (payload) => {
        if ((payload.old as { event_id?: string }).event_id === eventId) recount();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, recount]);

  async function toggle() {
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { error } = going
      ? await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("profile_id", meId)
      : await supabase.from("event_rsvps").insert({ event_id: eventId, profile_id: meId, school_id: schoolId });
    setBusy(false);
    if (error) {
      setError("That didn't work. Please try again.");
      return;
    }
    setGoing(!going);
    setCount((c) => c + (going ? -1 : 1));
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-center">
        <p className="text-2xl leading-none font-bold">{count}</p>
        <p className="text-xs text-black/50">going</p>
      </div>
      {disabledReason ? (
        <p className="flex-1 text-sm text-black/50">{disabledReason}</p>
      ) : (
        <button onClick={toggle} disabled={busy} className={`flex-1 ${going ? "btn-secondary" : "btn-primary"} py-3`}>
          {busy ? "…" : going ? "✓ You're going · Cancel" : "I'm going"}
        </button>
      )}
      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}
