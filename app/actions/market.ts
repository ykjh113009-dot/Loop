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
      image_path: String(formData.get("image_path") ?? "") || null,
    })
    .select("id")
    .single();
  if (error) return { error: friendlyError(error) };
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
  const { data } = await supabase.from("listings").delete().eq("id", String(formData.get("id"))).eq("seller_id", me.id).select("image_path");
  const path = data?.[0]?.image_path;
  if (path) await supabase.storage.from("post-images").remove([path]);
  redirect("/market");
}
