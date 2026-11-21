import { Suspense } from "react";
import { PageSkeleton } from "@/components/skeleton";
import { MarketView } from "@/components/market/market-view";

export const metadata = { title: "Buy, sell & swap" };

export default function MarketPage(props: PageProps<"/market">) {
  return <Suspense fallback={<PageSkeleton />}><MarketView searchParams={props.searchParams} base="/market" /></Suspense>;
}
