import "server-only";
import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";

// Loads a club and what the current student can do in it.
export const getClub = cache(async (id: string) => {
  const me = await requireMe();
  const supabase = await createClient();
  const [{ data: club }, { data: membership }, { count }] = await Promise.all([
    supabase.from("clubs").select("id, name, emoji, description, status, school_id, created_at").eq("id", id).maybeSingle(),
    supabase.from("club_members").select("role").eq("club_id", id).eq("profile_id", me.id).maybeSingle(),
    supabase.from("club_members").select("profile_id", { count: "exact", head: true }).eq("club_id", id),
  ]);
  if (!club) notFound();
  return {
    me,
    club,
    memberCount: count ?? 0,
    isMember: !!membership,
    isLeader: membership?.role === "leader",
  };
});
