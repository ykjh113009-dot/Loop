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

function content(fd: FormData) {
  const hasFile = !!s(fd, "file_path");
  return {
    subject_id: s(fd, "subject_id"), title: s(fd, "title"), description: s(fd, "description"), type: s(fd, "type"), author: s(fd, "author"),
    link_url: hasFile ? "" : s(fd, "link_url"), file_path: s(fd, "file_path"), file_name: s(fd, "file_name"),
    file_size: s(fd, "file_size"), file_mime: s(fd, "file_mime"), file_hash: s(fd, "file_hash"), cover_path: s(fd, "cover_path"),
    downloadable: fd.get("downloadable") === "on", rights_confirmed: fd.get("rights_confirmed") === "on",
  };
}

// Suggest a resource or edit one. "intent" is draft or submit.
export async function saveLibraryResource(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireMe();
  const submit = s(fd, "intent") !== "draft";
  const supabase = await createClient();
  const { error } = await supabase.rpc("library_submit", { p_resource: (s(fd, "id") || null) as string, p: content(fd), p_submit: submit });
  if (error) return { error: friendlyError(error) };
  refresh();
  redirect(`/academic-resources/my-contributions?${submit ? "sent=1" : "saved=1"}`);
}

export async function deleteLibraryResource(_: ActionResult, fd: FormData) {
  const r = await rpc("library_delete", { p_resource: s(fd, "id") });
  if (r?.ok) redirect("/academic-resources/my-contributions");
  return r;
}

export async function reviewLibrary(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const approve = s(fd, "decision") === "approve";
  const dl = s(fd, "downloadable");
  const r = await rpc("library_review", { p_revision: s(fd, "id"), p_approve: approve, p_note: s(fd, "note"), p_downloadable: dl === "" ? null : dl === "yes" });
  if (r?.ok) redirect("/academic-resources/review?done=" + (approve ? "approved" : "rejected"));
  return r;
}

export async function saveOfficialResource(_: ActionResult, fd: FormData): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const p = { ...content(fd), visibility: s(fd, "visibility") || "visible" };
  const { data, error } = await supabase.rpc("library_official_save", { p_id: (s(fd, "id") || null) as string, p });
  if (error) return { error: friendlyError(error) };
  refresh();
  redirect(`/academic-resources/resource/${data}`);
}

export async function flagLibrary(_: ActionResult, fd: FormData) {
  return rpc("library_flag", { p_resource: s(fd, "id"), p_reason: s(fd, "reason") }, "Flagged for review.");
}
export async function resolveLibraryFlag(_: ActionResult, fd: FormData) {
  return rpc("library_resolve_flag", { p_flag: s(fd, "id"), p_outcome: s(fd, "outcome"), p_note: s(fd, "note") }, "Done.");
}
export async function restoreLibrary(_: ActionResult, fd: FormData) {
  return rpc("library_restore", { p_resource: s(fd, "id") }, "Restored.");
}

export async function rateLibrary(_: ActionResult, fd: FormData) {
  const stars = Number(s(fd, "stars"));
  return rpc("library_rate", { p_resource: s(fd, "id"), p_stars: s(fd, "remove") ? null : stars, p_review: s(fd, "review") }, s(fd, "remove") ? "Rating removed." : "Thanks for rating.");
}

export async function saveToLibrary(_: ActionResult, fd: FormData) {
  return rpc("library_save", { p_resource: s(fd, "id"), p_on: s(fd, "on") === "1" });
}

export async function setLibraryPoints(_: ActionResult, fd: FormData) {
  return rpc("library_set_points", { p_points: Number(s(fd, "points")) }, "Saved.");
}
