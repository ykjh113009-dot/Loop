"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Counts a view once the page is really open. The database ignores repeats, the owner and unpublished resources.
export function ViewTracker({ id }: { id: string }) {
  useEffect(() => {
    const timer = setTimeout(() => { createClient().rpc("library_track", { p_resource: id, p_kind: "view" }).then(() => {}, () => {}); }, 1500);
    return () => clearTimeout(timer);
  }, [id]);
  return null;
}
