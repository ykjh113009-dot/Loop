import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { personLabel } from "@/lib/people";
import { timeAgo } from "@/lib/time";
import { deleteAnswer, deleteQuestion } from "@/app/actions/tawjihi";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { ReportButton } from "@/components/report-button";
import { PageSkeleton } from "@/components/skeleton";
import { SubmitButton } from "@/components/submit-button";
import { AnswerForm } from "../forms";

const PERSON = "id, full_name, avatar, grade, role, alumni_year, university, major" as const;

async function Question({ params }: { params: PageProps<"/tawjihi/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const [{ data: q }, { data: answers }] = await Promise.all([
    supabase.from("tawjihi_questions").select(`*, author:profiles(${PERSON})`).eq("id", id).maybeSingle(),
    supabase.from("tawjihi_answers").select(`id, body, status, created_at, author_id, author:profiles(${PERSON})`).eq("question_id", id).order("created_at"),
  ]);
  if (!q) notFound();
  // Mentor answers first, then the rest in order.
  const sorted = [...(answers ?? [])].sort((a, b) => Number(!!b.author?.alumni_year) - Number(!!a.author?.alumni_year));

  return (
    <div className="space-y-4">
      <PageHeader title="Tawjihi corner" back="/tawjihi" />
      <article className="card space-y-2 p-4">
        <div className="flex items-center gap-2 text-xs text-black/45">
          <span className="chip bg-brand-50 text-brand-800">{q.subject}</span>
          <span className="flex-1">{q.author?.full_name} · {personLabel(q.author)} · {timeAgo(q.created_at)}</span>
          {q.author_id === me.id ? (
            <form action={deleteQuestion}>
              <input type="hidden" name="id" value={q.id} />
              <button className="hover:text-red-600">Delete</button>
            </form>
          ) : (
            <ReportButton targetType="question" targetId={q.id} compact />
          )}
        </div>
        <h1 className="text-lg font-bold">{q.title}</h1>
        {q.body && <p className="whitespace-pre-wrap text-black/75">{q.body}</p>}
        {q.status === "held" && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Only you can see this. It&apos;s waiting for a moderator.</p>}
      </article>

      <h2 className="section-title">{sorted.length} {sorted.length === 1 ? "answer" : "answers"}</h2>
      {sorted.map((a) => {
        const mentor = !!a.author?.alumni_year;
        return (
          <article key={a.id} className={`card space-y-2 p-4 ${mentor ? "border-brand-200 bg-brand-50/40" : ""}`}>
            <div className="flex items-start gap-3">
              <Link href={`/profile/${a.author_id}`}><Avatar avatar={a.author?.avatar ?? "a01"} size="sm" /></Link>
              <div className="min-w-0 flex-1 text-sm">
                <p>
                  <Link href={`/profile/${a.author_id}`} className="font-semibold">{a.author?.full_name}</Link>
                  {mentor && <span className="chip ml-1.5 bg-brand-700 px-2 py-0.5 text-[10px] text-white">🎓 Alumni mentor</span>}
                </p>
                <p className="text-xs text-black/45">
                  {mentor ? [a.author?.major, a.author?.university].filter(Boolean).join(" · ") || personLabel(a.author) : personLabel(a.author)} · {timeAgo(a.created_at)}
                </p>
              </div>
              {a.author_id === me.id ? (
                <form action={deleteAnswer}>
                  <input type="hidden" name="id" value={a.id} />
                  <SubmitButton className="text-xs text-black/40 hover:text-red-600" pendingText="…">Delete</SubmitButton>
                </form>
              ) : (
                <ReportButton targetType="answer" targetId={a.id} compact />
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap">{a.body}</p>
            {a.status === "held" && <p className="text-xs text-amber-800">Only you can see this. It&apos;s waiting for a moderator.</p>}
          </article>
        );
      })}

      {q.status === "visible" && !me.isSuspended && <AnswerForm questionId={q.id} />}
    </div>
  );
}

export default function QuestionPage(props: PageProps<"/tawjihi/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Question params={props.params} />
    </Suspense>
  );
}
