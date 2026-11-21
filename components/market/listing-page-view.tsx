"use client";

import { useRouter } from "next/navigation";
import { ListingDetailsView } from "@/components/market/listing-details";
import type { Locale } from "@/lib/i18n";
import type { ListingDetails } from "@/lib/market-details";

// The same details view as the popup, shown on its own page (for links, notifications and the seller's management tools).
export function ListingPageView({ d, locale }: { d: ListingDetails; locale: Locale }) {
  const router = useRouter();
  return <ListingDetailsView d={d} locale={locale} onChanged={() => router.refresh()} />;
}
