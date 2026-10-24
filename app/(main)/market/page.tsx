import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signImages } from "@/lib/images";
import { CATEGORIES, priceLabel } from "@/lib/market";
import { Empty } from "@/components/empty";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { MarketSafetyNote } from "@/components/safety-note";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Buy, sell & swap" };

async function Market({ searchParams }: { searchParams: PageProps<"/market">["searchParams"] }) {
  const me = await requireMe();
  const sp = await searchParams;
  const category = typeof sp.category === "string" && sp.category in CATEGORIES ? sp.category : "";
  const mine = sp.mine === "1";
  const supabase = await createClient();
  let query = supabase
    .from("listings")
    .select("id, title, kind, price, status, image_path, created_at, seller_id")
    .order("created_at", { ascending: false })
    .limit(60);
  if (mine) query = query.eq("seller_id", me.id);
  else query = query.in("status", ["active", "reserved"]);
  if (category) query = query.eq("category", category);
  const { data } = await query;
  const listings = data ?? [];
  const urls = await signImages(supabase, listings.map((l) => l.image_path));

  return (
    <div className="space-y-4">
      <MarketSafetyNote />
      <div className="flex gap-2">
        {me.isStudent && !me.isSuspended && (
          <Link href="/market/new" className="btn-primary flex-1"><Icon name="plus" className="size-4" /> Post an item</Link>
        )}
        <Link href={mine ? "/market" : "/market?mine=1"} className="btn-secondary flex-1">{mine ? "All items" : "My items"}</Link>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        <Link href={mine ? "/market?mine=1" : "/market"} className={`chip shrink-0 ${!category ? "bg-brand-700 text-white" : ""}`}>All</Link>
        {Object.entries(CATEGORIES).map(([id, label]) => (
          <Link key={id} href={`/market?category=${id}${mine ? "&mine=1" : ""}`} className={`chip shrink-0 ${category === id ? "bg-brand-700 text-white" : ""}`}>{label}</Link>
        ))}
      </div>
      {listings.length === 0 ? (
        <Empty emoji="🛍️" title="Nothing here yet">Have old books or a uniform you don&apos;t need? Post them!</Empty>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {listings.map((l) => {
            const url = l.image_path ? urls.get(l.image_path) : null;
            return (
              <Link key={l.id} href={`/market/${l.id}`} className="card overflow-hidden hover:bg-black/[0.02]">
                <div className="flex aspect-square items-center justify-center bg-black/5 text-4xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {url ? <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" /> : "📦"}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-sm leading-tight font-medium">{l.title}</p>
                  <p className="mt-1 flex items-center justify-between text-sm">
                    <span className="font-bold text-brand-800">{priceLabel(l)}</span>
                    {l.status !== "active" && <span className="chip px-2 py-0.5 text-[10px]">{l.status === "held" ? "checking" : l.status}</span>}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MarketPage(props: PageProps<"/market">) {
  return (
    <>
      <PageHeader title="Buy, sell & swap" back="/more" />
      <Suspense fallback={<PageSkeleton />}>
        <Market searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
