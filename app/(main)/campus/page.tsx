import { requireMe } from "@/lib/auth";
import { ComingSoon } from "@/components/ui/coming-soon";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Campus Map & Directory" };

async function Page() {
  await requireMe();
  return <ComingSoon title="Campus Map & Directory" subtitle="Find your way around school." scene="campus" intro="The Campus Map will show buildings, facilities and useful contacts." expect={["An interactive school map","Facilities and where to find them","A directory of offices and who to ask"]} meanwhile={[{"href":"/events","label":"See events and locations"},{"href":"/clubs","label":"Find where clubs meet"}]} />;
}

export default function CampusPage() {
  return <Suspense fallback={<PageSkeleton />}><Page /></Suspense>;
}
