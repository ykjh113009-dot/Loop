import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";

export type Profile = Tables<"profiles">;
export type Me = Profile & {
  school: Pick<Tables<"schools">, "id" | "name" | "grades">;
  isSuspended: boolean;
  isStaff: boolean;
  isAdmin: boolean;
  isCounselor: boolean;
  isAlumni: boolean;
  /** A current student (not an alumni mentor or the counselor). */
  isStudent: boolean;
};

// Looks up the signed-in student once per request.
export const getMe = cache(async (): Promise<Me | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*, school:schools!profiles_school_id_fkey(id, name, grades)")
    .eq("id", userId)
    .single();
  if (!profile || !profile.school) return null;

  const isSuspended = !!profile.suspended_until && new Date(profile.suspended_until) > new Date();
  return {
    ...profile,
    school: profile.school,
    isSuspended,
    // Suspended moderators lose their powers until the suspension ends.
    isStaff: !isSuspended && (profile.role === "moderator" || profile.role === "admin"),
    isAdmin: !isSuspended && profile.role === "admin",
    isCounselor: !isSuspended && profile.role === "counselor",
    isAlumni: profile.alumni_year !== null,
    isStudent: profile.role !== "counselor" && profile.alumni_year === null,
  };
});

// Use at the top of every signed-in page. Sends people to the right place
// if they are signed out, have not finished the welcome screen, or were removed.
export async function requireMe(need?: "staff" | "admin"): Promise<Me> {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.deactivated_at) redirect("/removed");
  if (!me.onboarded_at) redirect("/welcome");
  if (need === "staff" && !me.isStaff) redirect("/home");
  if (need === "admin" && !me.isAdmin) redirect("/home");
  return me;
}
