"use server";

import { refresh } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/errors";
import { dispatchPush } from "@/lib/push";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const n = (fd: FormData, k: string) => Number(fd.get(k));
const opt = (fd: FormData, k: string) => s(fd, k) || null;

// Calls a database function. The database checks who may do it again inside.
async function call(fn: string, args: Record<string, unknown>, message?: string): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn as "my_points", args as never);
  if (error) return { error: friendlyError(error) };
  after(dispatchPush);
  refresh();
  return { ok: true, message };
}

async function insert(table: string, row: Record<string, unknown>, message?: string): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.from(table as "clubs").insert(row as never);
  if (error) return { error: error.code === "23514" ? "Please check what you typed." : friendlyError(error) };
  refresh();
  return { ok: true, message };
}

async function remove(table: string, id: string): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.from(table as "clubs").delete().eq("id", id);
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true };
}

// ---- Points and the shop ---------------------------------------------------------
export async function claimPoints(_: ActionResult, fd: FormData) {
  return call("claim_points", { p_reason: s(fd, "reason"), p_description: s(fd, "description") }, "Sent. Staff will check it.");
}
export async function reviewPointClaim(_: ActionResult, fd: FormData) {
  const approve = fd.get("decision") === "approve";
  return call("review_point_claim", {
    p_claim: s(fd, "claimId"), p_approve: approve,
    p_points: approve && s(fd, "points") ? n(fd, "points") : null, p_note: s(fd, "note"),
  });
}
export async function redeemReward(_: ActionResult, fd: FormData) {
  return call("redeem_reward", { p_reward: s(fd, "rewardId") }, "Done! Check your points.");
}
export async function handleRedemption(_: ActionResult, fd: FormData) {
  return call("handle_redemption", { p_id: s(fd, "redemptionId"), p_fulfil: fd.get("decision") === "fulfil", p_note: s(fd, "note") });
}

export async function saveRule(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireMe("admin").catch(() => null);
  if (!me) return { error: "You are not allowed to do that." };
  const supabase = await createClient();
  const lim = (k: string) => (s(fd, k) === "" ? null : Math.max(0, Math.round(n(fd, k))));
  const { error } = await supabase.from("point_rules").upsert({
    school_id: me.school_id, reason: s(fd, "reason"), points: Math.min(1000, Math.max(0, Math.round(n(fd, "points")))),
    daily_limit: lim("daily_limit"), weekly_limit: lim("weekly_limit"), enabled: fd.get("enabled") === "on",
    updated_by: me.id, updated_at: new Date().toISOString(),
  });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true, message: "Saved." };
}

export async function saveReward(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const stock = s(fd, "stock");
  return insert("rewards", {
    school_id: me.school_id, name: s(fd, "name"), description: s(fd, "description"), cost: Math.round(n(fd, "cost")),
    kind: "prize", stock: stock === "" ? null : Math.round(Number(stock)), per_student_limit: Math.round(n(fd, "limit")) || 1,
    created_by: me.id, image_path: s(fd, "image_path") || null, category: s(fd, "category") || "other",
  }, "Reward added.");
}
// Edit a reward: name, details, price, how many are left, which category, and (optionally) a new picture.
export async function updateReward(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const stock = s(fd, "stock");
  const row: Record<string, unknown> = {
    name: s(fd, "name"), description: s(fd, "description"), cost: Math.round(n(fd, "cost")),
    stock: stock === "" ? null : Math.round(Number(stock)), per_student_limit: Math.round(n(fd, "limit")) || 1, category: s(fd, "category") || "other",
  };
  if (s(fd, "image_path")) row.image_path = s(fd, "image_path");
  const { error } = await supabase.from("rewards").update(row as never).eq("id", s(fd, "rewardId"));
  if (error) return { error: error.code === "23514" ? "Please check what you typed." : friendlyError(error) };
  refresh();
  return { ok: true, message: "Saved." };
}
export async function removeRewardImage(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.from("rewards").update({ image_path: null }).eq("id", s(fd, "rewardId"));
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true };
}
export async function setRewardActive(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.from("rewards").update({ active: fd.get("active") === "true" }).eq("id", s(fd, "rewardId"));
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true };
}

export async function reviewClubAchievement(_: ActionResult, fd: FormData) {
  const approve = fd.get("decision") === "approve";
  return call("review_club_achievement", { p_id: s(fd, "achievementId"), p_approve: approve, p_points: approve ? Math.round(n(fd, "points")) || 0 : 0 });
}

// ---- Houses and competitions -------------------------------------------------------
export async function createDefaultHouses(_: ActionResult, fd: FormData) {
  return call("create_default_houses", { p_count: Math.round(n(fd, "count")) }, "Houses created.");
}
export async function addHouse(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireMe();
  return insert("houses", { school_id: me.school_id, name: s(fd, "name"), emoji: s(fd, "emoji") || "🏠", color: s(fd, "color") || "olive", motto: s(fd, "motto") }, "House added.");
}
export async function deleteHouse(_: ActionResult, fd: FormData) {
  return remove("houses", s(fd, "houseId"));
}
export async function addHouseClass(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const m = /^(\d{1,2})([A-Za-z])$/.exec(s(fd, "class"));
  if (!m) return { error: "Write the class like 11A." };
  return insert("house_classes", { house_id: s(fd, "houseId"), school_id: me.school_id, grade: Number(m[1]), section: m[2].toUpperCase() }, "Class added.");
}
export async function removeHouseClass(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.from("house_classes").delete().eq("school_id", me.school_id).eq("grade", n(fd, "grade")).eq("section", s(fd, "section"));
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true };
}
export async function setStudentSection(_: ActionResult, fd: FormData) {
  const section = s(fd, "section").toUpperCase();
  return call("admin_set_section", { p_user: s(fd, "profileId"), p_section: section || null }, "Saved.");
}

export async function createCompetition(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const starts = new Date(s(fd, "starts")), ends = new Date(s(fd, "ends"));
  if (isNaN(+starts) || isNaN(+ends) || ends <= starts) return { error: "Choose a start and a later end." };
  return insert("competitions", {
    school_id: me.school_id, name: s(fd, "name"), description: s(fd, "description"), kind: s(fd, "kind") === "house" ? "house" : "team",
    starts_at: starts.toISOString(), ends_at: ends.toISOString(), team_size: Math.round(n(fd, "team_size")) || 5, created_by: me.id,
  }, "Competition created.");
}
export async function awardCompetition(_: ActionResult, fd: FormData) {
  return call("award_competition_points", {
    p_competition: s(fd, "competitionId"), p_house: opt(fd, "houseId"), p_team: opt(fd, "teamId"),
    p_points: Math.round(n(fd, "points")), p_note: s(fd, "note"),
  }, "Points given.");
}
export async function createTeam(_: ActionResult, fd: FormData) {
  return call("create_team", { p_competition: s(fd, "competitionId"), p_name: s(fd, "name") }, "Team created.");
}
export async function joinTeam(_: ActionResult, fd: FormData) {
  return call("join_team", { p_team: s(fd, "teamId") });
}
export async function leaveTeam(_: ActionResult, fd: FormData) {
  return call("leave_team", { p_team: s(fd, "teamId") });
}

// ---- Groups ---------------------------------------------------------------------------
export async function createGroup(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group", {
    p_name: s(fd, "name"), p_description: s(fd, "description"), p_emoji: s(fd, "emoji"),
    p_privacy: s(fd, "privacy") === "private" ? "private" : "public", p_official: fd.get("official") === "on",
  });
  if (error) return { error: friendlyError(error) };
  redirect(`/groups/${data}`);
}
export async function joinGroup(_: ActionResult, fd: FormData) {
  return call("join_group", { p_group: s(fd, "groupId") });
}
export async function leaveGroup(fd: FormData) {
  await requireMe();
  const supabase = await createClient();
  await supabase.rpc("leave_group", { p_group: String(fd.get("groupId")) });
  redirect("/groups");
}
export async function respondGroupRequest(_: ActionResult, fd: FormData) {
  return call("respond_group_request", { p_group: s(fd, "groupId"), p_profile: s(fd, "profileId"), p_approve: fd.get("decision") === "approve" });
}
export async function removeGroupMember(_: ActionResult, fd: FormData) {
  return call("remove_group_member", { p_group: s(fd, "groupId"), p_profile: s(fd, "profileId") });
}
export async function setGroupRole(_: ActionResult, fd: FormData) {
  return call("set_group_role", { p_group: s(fd, "groupId"), p_profile: s(fd, "profileId"), p_role: s(fd, "role") });
}
export async function updateGroup(_: ActionResult, fd: FormData) {
  return call("update_group", {
    p_group: s(fd, "groupId"), p_name: s(fd, "name"), p_description: s(fd, "description"), p_emoji: s(fd, "emoji"),
    p_privacy: s(fd, "privacy") === "private" ? "private" : "public",
  }, "Saved.");
}
export async function archiveGroup(fd: FormData) {
  await requireMe();
  const supabase = await createClient();
  await supabase.rpc("archive_group", { p_group: String(fd.get("groupId")) });
  redirect("/groups");
}

// A post in a group or a club (text, question or announcement).
export async function spacePost(_: ActionResult, fd: FormData) {
  const kind = ["question", "announcement"].includes(s(fd, "kind")) ? s(fd, "kind") : "text";
  return call("create_space_post", { p_type: s(fd, "type"), p_id: s(fd, "spaceId"), p_body: s(fd, "body"), p_kind: kind, p_image: null }, kind === "announcement" ? "Announcement sent to every member." : undefined);
}

// ---- Clubs ------------------------------------------------------------------------------
export async function applyToClub(_: ActionResult, fd: FormData) {
  return call("apply_to_club", { p_club: s(fd, "clubId"), p_message: s(fd, "message") }, "Application sent.");
}
export async function withdrawApplication(_: ActionResult, fd: FormData) {
  return call("withdraw_club_application", { p_application: s(fd, "applicationId") });
}
export async function reviewClubApplication(_: ActionResult, fd: FormData) {
  return call("review_club_application", { p_application: s(fd, "applicationId"), p_approve: fd.get("decision") === "approve" });
}
export async function updateClubSettings(_: ActionResult, fd: FormData) {
  return call("update_club_settings", {
    p_club: s(fd, "clubId"), p_description: s(fd, "description"), p_emoji: s(fd, "emoji"),
    p_recruiting: s(fd, "recruiting"), p_question: s(fd, "question"),
  }, "Saved.");
}
export async function setMemberTitle(_: ActionResult, fd: FormData) {
  return call("set_member_title", { p_club: s(fd, "clubId"), p_profile: s(fd, "profileId"), p_title: s(fd, "title") }, "Saved.");
}
export async function removeClubMember(_: ActionResult, fd: FormData) {
  return call("remove_club_member", { p_club: s(fd, "clubId"), p_profile: s(fd, "profileId") });
}
export async function addClubSession(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireMe();
  return insert("club_sessions", { club_id: s(fd, "clubId"), title: s(fd, "title"), held_on: s(fd, "date"), notes: s(fd, "notes"), created_by: me.id });
}
export async function setAttendance(_: ActionResult, fd: FormData) {
  return call("set_club_attendance", { p_session: s(fd, "sessionId"), p_profile: s(fd, "profileId"), p_present: fd.get("present") === "true" });
}
export async function addClubProject(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireMe();
  return insert("club_projects", { club_id: s(fd, "clubId"), name: s(fd, "name"), description: s(fd, "description"), created_by: me.id });
}
export async function addClubTask(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireMe();
  return insert("club_tasks", {
    club_id: s(fd, "clubId"), title: s(fd, "title"), assignee_id: opt(fd, "assignee"), project_id: opt(fd, "project"),
    due_on: opt(fd, "due"), created_by: me.id,
  });
}
export async function setTaskStatus(_: ActionResult, fd: FormData) {
  return call("set_task_status", { p_task: s(fd, "taskId"), p_status: s(fd, "status") });
}
export async function deleteClubItem(_: ActionResult, fd: FormData) {
  const table = ["club_tasks", "club_projects", "club_sessions", "club_budget", "club_resources"].find((t) => t === s(fd, "table"));
  if (!table) return { error: "Unknown item." };
  return remove(table, s(fd, "id"));
}
export async function addBudgetEntry(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireMe();
  return insert("club_budget", {
    club_id: s(fd, "clubId"), kind: s(fd, "kind") === "income" ? "income" : "expense", amount: n(fd, "amount"),
    description: s(fd, "description"), entry_date: s(fd, "date") || undefined, created_by: me.id,
  });
}
export async function addResource(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const me = await requireMe();
  return insert("club_resources", { club_id: s(fd, "clubId"), title: s(fd, "title"), url: opt(fd, "url"), notes: s(fd, "notes"), created_by: me.id });
}
export async function proposeAchievement(_: ActionResult, fd: FormData) {
  return call("propose_club_achievement", { p_club: s(fd, "clubId"), p_title: s(fd, "title"), p_description: s(fd, "description"), p_date: s(fd, "date") || null }, "Sent. An admin will check it.");
}

// ---- Leadership --------------------------------------------------------------------------
export async function postClassAnnouncement(_: ActionResult, fd: FormData) {
  return call("post_class_announcement", { p_class: s(fd, "class"), p_title: s(fd, "title"), p_body: s(fd, "body") }, "Sent to your class.");
}
