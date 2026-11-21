"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireMe } from "@/lib/auth";
import { CATEGORIES, CONDITIONS } from "@/lib/market";
import { friendlyError, type ActionResult } from "@/lib/errors";

export async function createListing(_: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireMe();
  const title = String(formData.get("title") ?? "").trim();
  const kind = String(formData.get("kind"));
  const category = String(formData.get("category"));
  const condition = String(formData.get("condition"));
  const price = Number(formData.get("price"));
  if (title.length < 3) return { error: "Give your item a title." };
  if (!["sell", "swap", "free"].includes(kind)) return { error: "Choose sell, swap or free." };
  if (!(category in CATEGORIES) || !(condition in CONDITIONS)) return { error: "Choose a category and condition." };
  if (kind === "sell" && !(price >= 0 && price <= 5000)) return { error: "Enter a price between ₪0 and ₪5000." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .insert({
      seller_id: me.id,
      school_id: me.school_id,
      title: title.slice(0, 80),
      description: String(formData.get("description") ?? "").trim().slice(0, 800),
      category,
      kind,
      condition,
      price: kind === "sell" ? Math.round(price * 100) / 100 : null,
      location: String(formData.get("location") ?? "").trim().slice(0, 80),
      image_path: formData.getAll("image_path").map(String).filter(Boolean)[0] ?? null,
    })
    .select("id")
    .single();
  if (error) return { error: friendlyError(error) };
  const paths = formData.getAll("image_path").map(String).filter(Boolean).slice(0, 4);
  if (paths.length) await supabase.rpc("set_listing_images", { p_listing: data.id, p_paths: paths });
  redirect(`/market/${data.id}`);
}

export async function setListingStatus(formData: FormData) {
  const me = await requireMe();
  const status = String(formData.get("status"));
  if (!["active", "reserved", "sold"].includes(status)) return;
  const supabase = await createClient();
  await supabase.from("listings").update({ status }).eq("id", String(formData.get("id"))).eq("seller_id", me.id);
  refresh();
}

export async function deleteListing(formData: FormData) {
  const me = await requireMe();
  const supabase = await createClient();
  const id = String(formData.get("id"));
  const { data: imgs } = await supabase.from("listing_images").select("path").eq("listing_id", id);
  const { data } = await supabase.from("listings").delete().eq("id", id).eq("seller_id", me.id).select("image_path");
  const paths = [...new Set([...(imgs ?? []).map((i) => i.path), ...(data ?? []).map((d) => d.image_path).filter((p): p is string => !!p)])];
  if (data?.length && paths.length) await supabase.storage.from("post-images").remove(paths);
  redirect("/market");
}

// ---- Item details: save, offers -------------------------------------------------------
export async function setListingSaved(listingId: string, save: boolean): Promise<ActionResult> {
  const me = await requireMe();
  if (!me.isStudent || me.isSuspended) return { error: "Only students can save items." };
  const supabase = await createClient();
  const { error } = save
    ? await supabase.from("listing_saves").upsert({ profile_id: me.id, listing_id: listingId, school_id: me.school_id }, { onConflict: "profile_id,listing_id", ignoreDuplicates: true })
    : await supabase.from("listing_saves").delete().eq("profile_id", me.id).eq("listing_id", listingId);
  if (error) return { error: friendlyError(error) };
  return { ok: true };
}

export async function makeOffer(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireMe();
  const amount = Number(formData.get("amount"));
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Enter the amount you want to offer." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("make_listing_offer", {
    p_listing: String(formData.get("listingId")), p_amount: amount, p_message: String(formData.get("message") ?? ""),
  });
  if (error) return { error: friendlyError(error) };
  return { ok: true, message: "Offer sent. The seller will get a notification." };
}

export async function withdrawOffer(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const { error } = await supabase.rpc("withdraw_listing_offer", { p_id: String(formData.get("offerId")) });
  if (error) return { error: friendlyError(error) };
  return { ok: true, message: "Offer withdrawn." };
}

export async function respondOffer(_: ActionResult, formData: FormData): Promise<ActionResult> {
  await requireMe();
  const supabase = await createClient();
  const accept = formData.get("decision") === "accept";
  const { error } = await supabase.rpc("respond_listing_offer", { p_id: String(formData.get("offerId")), p_accept: accept });
  if (error) return { error: friendlyError(error) };
  refresh();
  return { ok: true, message: accept ? "Offer accepted. The item is now reserved for them." : "Offer declined." };
}
