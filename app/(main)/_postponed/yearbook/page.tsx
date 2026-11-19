import { requireMe } from "@/lib/auth";
import { ComingSoon } from "@/components/ui/coming-soon";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Digital Yearbook" };

async function Page() {
  await requireMe();
  return <ComingSoon title="Digital Yearbook" subtitle="Your school year, remembered together." scene="community" intro="The Digital Yearbook will gather class photos, memories and messages in one place." expect={["A page for every class and club","Photos and memories shared by students","Messages and signatures between friends"]} meanwhile={[{"href":"/clubs","label":"Visit your clubs"},{"href":"/events","label":"See upcoming events"}]} />;
}

export default function YearbookPage() {
  return <Suspense fallback={<PageSkeleton />}><Page /></Suspense>;
}
