import { requireMe } from "@/lib/auth";
import { ComingSoon } from "@/components/ui/coming-soon";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Skill Exchange" };

async function Page() {
  await requireMe();
  return <ComingSoon title="Skill Exchange" subtitle="Teach what you know. Learn what you want." scene="community" intro="Skill Exchange will let students offer a skill and ask for one in return, like guitar for chemistry help." expect={["Offer a skill you are good at","Ask for a skill you want to learn","Match with classmates and arrange a swap"]} meanwhile={[{"href":"/tutors","label":"Browse the Tutors Directory"},{"href":"/groups","label":"Find a group"}]} />;
}

export default function SkillExchangePage() {
  return <Suspense fallback={<PageSkeleton />}><Page /></Suspense>;
}
