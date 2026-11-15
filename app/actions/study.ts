"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { friendlyError, type ActionResult } from "@/lib/errors";

const s = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

async function rpc(fn: string, args: Record<string, unknown>, message?: string): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.rpc(fn as "my_points", args as never);
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true, message };
}

// ---- Academic resources ---------------------------------------------------------------
export async function addStudyResource(_: ActionResult, fd: FormData) {
  return rpc("add_study_resource", { p_category: s(fd, "category"), p: { title: s(fd, "title"), url: s(fd, "url"), kind: s(fd, "kind"), description: s(fd, "description") } }, "Added.");
}
export async function removeStudyResource(_: ActionResult, fd: FormData) {
  return rpc("remove_study_resource", { p_id: s(fd, "id") });
}
export async function addStudyCategory(_: ActionResult, fd: FormData) {
  return rpc("add_study_category", { p_name: s(fd, "name"), p_emoji: s(fd, "emoji") }, "Subject added.");
}

// ---- University and opportunities -----------------------------------------------------
export async function saveStudyOpportunity(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireMe();
  const docs = [1, 2, 3].map((n) => ({ label: s(fd, `doc_label${n}`), url: s(fd, `doc_url${n}`) })).filter((d) => d.label && d.url);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_study_opportunity", {
    p_id: (s(fd, "id") || null) as string,
    p: {
      category: s(fd, "category"), title: s(fd, "title"), organization: s(fd, "organization"), description: s(fd, "description"),
      eligibility: s(fd, "eligibility"), deadline: s(fd, "deadline"), link: s(fd, "link"), instructions: s(fd, "instructions"),
      extra_info: s(fd, "extra_info"), documents: docs, is_sample: fd.get("is_sample") === "on", status: fd.get("hidden") === "on" ? "hidden" : "active",
    },
  });
  if (error) return { error: friendlyError(error) };
  refresh();
  redirect(`/opportunities/${data}`);
}
export async function deleteStudyOpportunity(fd: FormData) {
  await requireMe();
  const supabase = await createClient();
  await supabase.rpc("delete_study_opportunity", { p_id: s(fd, "id") });
  refresh();
  redirect("/opportunities");
}

// ---- Top 10 prizes --------------------------------------------------------------------
export async function setTop10Prize(_: ActionResult, fd: FormData) {
  return rpc("set_top10_prize", { p_place: Number(s(fd, "place")), p_title: s(fd, "title"), p_description: s(fd, "description") }, "Saved.");
}
export async function setTop10Settings(_: ActionResult, fd: FormData) {
  return rpc("set_top10_settings", { p_period: s(fd, "period"), p_rules: s(fd, "rules") }, "Saved.");
}
