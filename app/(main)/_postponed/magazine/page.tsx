import { requireMe } from "@/lib/auth";
import { ComingSoon } from "@/components/ui/coming-soon";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Loop Magazine" };

async function Page() {
  await requireMe();
  return <ComingSoon title="Loop Magazine" subtitle="Stories, art and ideas from your school." scene="books" intro="Loop Magazine will be the place for student writing, photography, interviews and news." expect={["Student articles and photo stories","Issues put together by an editorial team","Submissions reviewed before they are published"]} meanwhile={[{"href":"/community","label":"Read the community feed"},{"href":"/academic-resources","label":"Open Academic Resources"}]} />;
}

export default function MagazinePage() {
  return <Suspense fallback={<PageSkeleton />}><Page /></Suspense>;
}
