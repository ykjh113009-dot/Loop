import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import { TAWJIHI_TOPICS } from "@/lib/subjects";
import { Avatar } from "@/components/avatar";
import { Empty } from "@/components/empty";
import { Icon } from "@/components/icons";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Tawjihi corner" };

async function Tawjihi({ searchParams }: { searchParams: PageProps<"/tawjihi">["searchParams"] }) {
  const me = await requireMe();
  const { topic: raw } = await searchParams;
  const topic = typeof raw === "string" && TAWJIHI_TOPICS.includes(raw) ? raw : "";
  const supabase = await createClient();
  let query = supabase
    .from("tawjihi_questions")
    .select("id, subject, title, status, created_at, author:profiles(full_name, grade), tawjihi_answers(count)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (topic) query = query.eq("subject", topic);
  const [{ data: questions }, { data: mentors }] = await Promise.all([
    query,
    supabase
      .from("profiles")
      .select("id, full_name, avatar, alumni_year, university, major")
      .not("alumni_year", "is", null)
      .is("deactivated_at", null)
      .not("onboarded_at", "is", null)
      .order("alumni_year", { ascending: false }),
  ]);

  return (
    <div className="space-y-5">
      <p className="text-sm text-black/60">
        Questions about Tawjihi, studying and university — answered by classmates and <strong>alumni mentors</strong> who
        already did it. Everything here is public to your school.
      </p>
      {!me.isSuspended && (
        <Link href="/tawjihi/ask" className="btn-primary w-full"><Icon name="plus" className="size-4" /> Ask a question</Link>
      )}

      {mentors && mentors.length > 0 && (
        <section>
          <h2 className="section-title">Alumni mentors</h2>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {mentors.map((m) => (
              <Link key={m.id} href={`/profile/${m.id}`} className="card w-44 shrink-0 p-3">
                <Avatar avatar={m.avatar} />
                <p className="mt-2 text-sm leading-tight font-semibold">{m.full_name}</p>
                <p className="text-xs text-black/50">Class of {m.alumni_year}</p>
                {(m.major || m.university) && <p className="mt-1 text-xs leading-tight text-black/65">{[m.major, m.university].filter(Boolean).join(" · ")}</p>}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="section-title">Questions</h2>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          <Link href="/tawjihi" className={`chip shrink-0 ${!topic ? "bg-brand-700 text-white" : ""}`}>All</Link>
          {TAWJIHI_TOPICS.map((t) => (
            <Link key={t} href={`/tawjihi?topic=${encodeURIComponent(t)}`} className={`chip shrink-0 ${topic === t ? "bg-brand-700 text-white" : ""}`}>{t}</Link>
          ))}
        </div>
        {(questions ?? []).length === 0 ? <Empty emoji="🎓" title="No questions yet">Be the first to ask!</Empty> : (questions ?? []).map((q) => {
          const answers = q.tawjihi_answers?.[0]?.count ?? 0;
          return (
            <Link key={q.id} href={`/tawjihi/${q.id}`} className="card block p-4 hover:bg-black/[0.02]">
              <p className="text-xs text-black/45">
                <span className="chip mr-1 bg-brand-50 text-brand-800">{q.subject}</span>
                {q.author?.full_name} · {timeAgo(q.created_at)}
              </p>
              <p className="mt-1.5 font-semibold">{q.title}</p>
              <p className={`mt-1 text-xs ${answers ? "text-brand-700" : "text-black/45"}`}>
                {answers ? `${answers} ${answers === 1 ? "answer" : "answers"}` : "No answers yet"}
                {q.status === "held" && " · waiting for a moderator"}
              </p>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

export default function TawjihiPage(props: PageProps<"/tawjihi">) {
  return (
    <>
      <PageHeader title="Tawjihi corner" back="/more" />
      <Suspense fallback={<PageSkeleton />}>
        <Tawjihi searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
