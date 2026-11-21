import { Suspense } from "react";
import { PageSkeleton } from "@/components/skeleton";
import { MarketView } from "@/components/market/market-view";

export const metadata = { title: "Marketplace" };

// The Marketplace is the student market (buy, sell, swap). The Reward Shop and the Top 10 Prizes have their own page.
export default function MarketplacePage(props: PageProps<"/marketplace">) {
  return <Suspense fallback={<PageSkeleton />}><MarketView searchParams={props.searchParams} base="/market" /></Suspense>;
}
