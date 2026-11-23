"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// The platform owner signs in from a personal Google account (for example Gmail). This is not shown to anyone: it appears only at
// /login?owner=1. The database still refuses every address that is not on the owner list.
export function OwnerSignIn() {
  const params = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  if (!params.has("owner")) return null;

  async function go() {
    setLoading(true);
    setMessage(null);
    document.cookie = "loop_next=; path=/; max-age=0; samesite=lax";
    const { error } = await createClient().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback`, queryParams: { prompt: "select_account" } },
    });
    if (error) {
      setMessage("We couldn't reach Google. Please try again.");
      setLoading(false);
    }
  }

  return (
    <>
      {message && <p role="alert" className="lp-notice">{message}</p>}
      <button type="button" onClick={go} disabled={loading} className="lp-gbtn" data-owner-sign-in>
        {loading ? "Opening Google…" : "Platform owner: continue with Google"}
      </button>
    </>
  );
}
