import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { toLocalInput } from "@/lib/time";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { ChallengeForm } from "../challenge-form";

export const metadata = { title: "New challenge" };

async function New() {
  const me = await requireMe();
  const { locale } = await getT();
  const start = new Date();
  start.setMinutes(0, 0, 0);
  return (
    <div className="mx-auto max-w-2xl">
      <ChallengeForm schoolId={me.school_id} userId={me.id} locale={locale} draft={{
        title: "", description: "", instructions: "", rules: "", emoji: "🏁", category: "creative", kind: "real_life",
        starts: toLocalInput(start), ends: toLocalInput(new Date(start.getTime() + 7 * 24 * 3600 * 1000)),
        reward_mode: "fixed", points: 20, prizes: [], audience: "school", audience_grade: null, audience_section: null,
        proof_kinds: ["photo", "text"], questions: [], max_participants: null, attempts: 1, rewards: 1, cover_path: null,
      }} />
    </div>
  );
}

export default function NewChallengePage() {
  return (
    <>
      <PageHeader title="Create a challenge" back="/challenges" />
      <Suspense fallback={<PageSkeleton />}><New /></Suspense>
    </>
  );
}
