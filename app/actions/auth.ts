"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_ACCOUNTS, isDemoMode } from "@/lib/demo";
import { afterSignInPath } from "@/lib/applications";

export async function demoSignIn(formData: FormData) {
  const email = String(formData.get("email"));
  // Demo sign-in only works when DEMO_MODE is on, and only for demo accounts.
  if (!isDemoMode() || !DEMO_ACCOUNTS.some((a) => a.email === email)) {
    redirect("/login?error=demo");
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: process.env.DEMO_PASSWORD ?? "pbsgo-demo",
  });
  if (error) redirect("/login?error=demo");
  redirect(await afterSignInPath(supabase, data.user.id));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
