import "server-only";
import { createClient } from "@/lib/supabase/server";
import { signImages } from "@/lib/images";
import { CATEGORIES, CONDITIONS, priceLabel } from "@/lib/market";
import { timeAgo } from "@/lib/time";

export type ListingDetails = {
  id: string;
  title: string;
  kind: string;
  price: number | null;
  priceText: string;
  status: string;
  condition: string;
  conditionText: string;
  categoryText: string;
  description: string;
  location: string;
  posted: string;
  images: string[];
  seller: { id: string; name: string; avatar: string; grade: number | null };
  mine: boolean;
  saved: boolean;
  canAct: boolean;
  canOffer: boolean;
  myOffer: { id: string; amount: number; message: string } | null;
  offers: { id: string; name: string; avatar: string; grade: number | null; amount: number; message: string; posted: string }[];
};

// Everything the item-details view needs. The database decides what the signed-in student may see (listing, pictures, offers).
export async function loadListingDetails(id: string, me: { id: string; isStudent: boolean; isSuspended: boolean }): Promise<ListingDetails | null> {
  if (!/^[0-9a-f-]{36}$/.test(id)) return null;
  const supabase = await createClient();
  const { data: l } = await supabase.from("listings").select("*, seller:profiles!listings_seller_id_fkey(id, full_name, avatar, grade)").eq("id", id).maybeSingle();
  if (!l || !l.seller) return null;
  const mine = l.seller_id === me.id;
  const [{ data: imgs }, { data: saved }, { data: myOffer }, { data: offers }] = await Promise.all([
    supabase.from("listing_images").select("path").eq("listing_id", id).order("sort"),
    supabase.from("listing_saves").select("listing_id").eq("listing_id", id).eq("profile_id", me.id).maybeSingle(),
    mine ? Promise.resolve({ data: null }) : supabase.from("listing_offers").select("id, amount, message").eq("listing_id", id).eq("buyer_id", me.id).eq("status", "pending").maybeSingle(),
    mine ? supabase.from("listing_offers").select("id, amount, message, created_at, buyer:profiles!listing_offers_buyer_id_fkey(full_name, avatar, grade)").eq("listing_id", id).eq("status", "pending").order("amount", { ascending: false }) : Promise.resolve({ data: [] }),
  ]);
  const paths = (imgs ?? []).map((x) => x.path);
  if (paths.length === 0 && l.image_path) paths.push(l.image_path);
  const urls = await signImages(supabase, paths);
  const canAct = me.isStudent && !me.isSuspended;
  return {
    id: l.id, title: l.title, kind: l.kind, price: l.price === null ? null : Number(l.price), priceText: priceLabel(l), status: l.status,
    condition: l.condition, conditionText: CONDITIONS[l.condition] ?? l.condition, categoryText: CATEGORIES[l.category] ?? l.category,
    description: l.description, location: l.location ?? "", posted: timeAgo(l.created_at),
    images: paths.map((p) => urls.get(p)).filter((u): u is string => !!u),
    seller: { id: l.seller.id, name: l.seller.full_name, avatar: l.seller.avatar, grade: l.seller.grade },
    mine, saved: !!saved, canAct,
    canOffer: canAct && !mine && l.kind === "sell" && l.price !== null && l.status === "active",
    myOffer: myOffer ? { id: myOffer.id, amount: Number(myOffer.amount), message: myOffer.message } : null,
    offers: (offers ?? []).map((o) => {
      const b = o.buyer as unknown as { full_name: string; avatar: string; grade: number | null } | null;
      return { id: o.id, name: b?.full_name ?? "", avatar: b?.avatar ?? "a01", grade: b?.grade ?? null, amount: Number(o.amount), message: o.message, posted: timeAgo(o.created_at) };
    }),
  };
}
