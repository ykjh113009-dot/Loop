import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import { NO_BADGES, type Badges } from "@/lib/badges";

export type Profile = Tables<"profiles">;
export type Me = Profile & {
  school: Pick<Tables<"schools">, "id" | "name" | "grades" | "admin_mfa_required">;
  isSuspended: boolean;
  /** Moderator, Admin or Super Admin (with the second sign-in step done when it is required). */
  isStaff: boolean;
  /** Admin or Super Admin. */
  isAdmin: boolean;
  isSuperAdmin: boolean;
  /** The school Owner or a platform owner: the only ones who appoint Super Admins. */
  isOwner: boolean;
  /** A platform owner (signs in from a listed Google address, above every school role). */
  isPlatformOwner: boolean;
  /** An Admin who has not passed the second sign-in step in this session yet. */
  needsMfa: boolean;
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
    .select("*, school:schools!profiles_school_id_fkey(id, name, grades, admin_mfa_required)")
    .eq("id", userId)
    .single();
  if (!profile) return null;
  // A deactivated account cannot read its school any more; it still needs to
  // reach the "account paused" page, so it gets an empty placeholder.
  if (!profile.school && profile.deactivated_at) {
    profile.school = { id: profile.school_id, name: "", grades: [], admin_mfa_required: true };
  }
  if (!profile.school) return null;

  const isSuspended = !!profile.suspended_until && new Date(profile.suspended_until) > new Date();
  const adminRole = profile.role === "admin" || profile.role === "super_admin";
  // Admins must pass the second sign-in step (authenticator app). The database
  // checks the same thing, so this only decides what the pages show.
  const needsMfa = adminRole && !isSuspended && profile.school.admin_mfa_required && data.claims.aal !== "aal2";
  const isAdmin = adminRole && !isSuspended && !needsMfa;
  // Only a Super Admin can be a platform owner, so only they pay for the extra check. The database decides for real.
  const isPlatformOwner = isAdmin && profile.role === "super_admin" ? (await supabase.rpc("is_platform_owner")).data === true : false;
  return {
    ...profile,
    school: profile.school,
    isSuspended,
    // Suspended moderators lose their powers until the suspension ends.
    isStaff: isAdmin || (!isSuspended && profile.role === "moderator"),
    isAdmin,
    isSuperAdmin: isAdmin && profile.role === "super_admin",
    isOwner: (isAdmin && profile.role === "super_admin" && profile.is_owner) || isPlatformOwner,
    isPlatformOwner,
    needsMfa,
    isCounselor: !isSuspended && profile.role === "counselor",
    isAlumni: profile.alumni_year !== null,
    isStudent: profile.role !== "counselor" && profile.alumni_year === null,
  };
});

// Use at the top of every signed-in page. Sends people to the right place
// if they are signed out, have not finished the welcome screen, or were removed.
export async function requireMe(need?: "staff" | "admin" | "super"): Promise<Me> {
  const me = await getMe();
  if (!me) redirect("/login?error=failed");
  if (me.deactivated_at) redirect("/removed");
  if (!me.onboarded_at) redirect("/welcome");
  // Admins who have not done the second step yet are sent to do it first.
  if (need && me.needsMfa) redirect("/security?verify=1");
  if (need === "staff" && !me.isStaff) redirect("/home");
  if (need === "admin" && !me.isAdmin) redirect("/home");
  if (need === "super" && !me.isSuperAdmin) redirect("/home");
  return me;
}

// The numbers on the bell and chat icons (unread alerts and chats).
export const getBadges = cache(async (): Promise<Badges> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_badges");
  return (data as Badges | null) ?? NO_BADGES;
});
