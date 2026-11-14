import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { toLocalInput } from "@/lib/time";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { ChallengeForm } from "../../challenge-form";

export const metadata = { title: "Edit challenge" };

async function Edit({ params }: { params: PageProps<"/challenges/[id]/edit">["params"] }) {
  const { id } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const { locale } = await getT();
  const { data: c } = await supabase.from("challenges").select("*").eq("id", id).eq("created_by", me.id).maybeSingle();
  if (!c) notFound();
  if (c.status !== "draft" && c.status !== "rejected") redirect(`/challenges/${id}`);
  const { data: prizes } = await supabase.from("challenge_prizes").select("place, points").eq("challenge_id", id).order("place");
  return (
    <div className="mx-auto max-w-2xl">
      <ChallengeForm schoolId={me.school_id} userId={me.id} locale={locale} draft={{
        id: c.id, title: c.title, description: c.description, instructions: c.instructions, rules: c.rules, emoji: c.emoji,
        category: c.category, kind: c.kind, starts: toLocalInput(c.starts_at), ends: toLocalInput(c.ends_at),
        reward_mode: c.reward_mode, points: c.points, prizes: (prizes ?? []).map((p) => p.points),
        audience: c.audience, audience_grade: c.audience_grade, audience_section: c.audience_section,
        proof_kinds: c.proof_kinds, questions: c.questions, max_participants: c.max_participants,
        attempts: c.attempts_per_student, rewards: c.rewards_per_student, cover_path: c.cover_path,
        review_note: c.status === "rejected" ? c.review_note : null,
      }} />
    </div>
  );
}

export default function EditChallengePage(props: PageProps<"/challenges/[id]/edit">) {
  return (
    <>
      <PageHeader title="Edit challenge" back="/challenges?tab=created" />
      <Suspense fallback={<PageSkeleton />}><Edit params={props.params} /></Suspense>
    </>
  );
}
