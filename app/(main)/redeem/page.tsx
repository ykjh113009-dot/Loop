import { requireMe } from "@/lib/auth";
import { ComingSoon } from "@/components/ui/coming-soon";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Redeem Rewards" };

// Spending points on rewards is postponed. The finished pages are kept in _postponed/rewards-redeem.
async function Page() {
  await requireMe();
  return <ComingSoon title="Redeem Rewards" subtitle="Turn your points into rewards." scene="gift" intro="Soon you will be able to spend the points you earn on prizes and profile unlocks chosen by your school." expect={["Prizes and unlockables you can redeem with your points", "Your points balance and what you have redeemed", "Spending points never lowers your level or your house's score"]} meanwhile={[{ href: "/shop", label: "See the Top 10 Prizes" }, { href: "/points", label: "See my points" }]} />;
}

export default function RedeemPage() {
  return <Suspense fallback={<PageSkeleton />}><Page /></Suspense>;
}
