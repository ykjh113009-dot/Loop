import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { RespondForm, SuggestionForm } from "./forms";
import { SUGGESTION_CATEGORIES } from "@/lib/labels";

export const metadata = { title: "Suggestion box" };

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-black/5" },
  reviewing: { label: "Looking at it", cls: "bg-amber-50 text-amber-800" },
  planned: { label: "Planned", cls: "bg-blue-50 text-blue-800" },
  done: { label: "Done ✓", cls: "bg-brand-50 text-brand-800" },
  declined: { label: "Not this time", cls: "bg-black/5 text-black/60" },
};

async function Suggestions({ searchParams }: { searchParams: PageProps<"/suggestions">["searchParams"] }) {
  const me = await requireMe();
  const supabase = await createClient();
  const { data: council } = await supabase.from("council_members").select("profile_id").eq("profile_id", me.id).maybeSingle();
  const canReview = me.isAdmin || !!council;
  const { tab } = await searchParams;
  const inbox = canReview && tab === "inbox";

  let query = supabase
    .from("suggestions")
    .select("id, category, title, body, status, response, created_at, author_id, author:profiles!suggestions_author_id_fkey(full_name, grade)")
    .order("created_at", { ascending: false })
    .limit(100);
  if (!inbox) query = query.eq("author_id", me.id);
  const { data } = await query;
  const items = data ?? [];

  return (
    <div className="space-y-4">
      {canReview && (
        <div className="flex gap-1 rounded-xl bg-black/5 p-1">
          <Link href="/suggestions" className={`flex-1 rounded-lg py-1.5 text-center text-sm font-medium ${!inbox ? "bg-white shadow-sm" : "text-black/55"}`}>My ideas</Link>
          <Link href="/suggestions?tab=inbox" className={`flex-1 rounded-lg py-1.5 text-center text-sm font-medium ${inbox ? "bg-white shadow-sm" : "text-black/55"}`}>Inbox (council)</Link>
        </div>
      )}
      {!inbox && !me.isSuspended && <SuggestionForm />}
      {items.length === 0 ? (
        <Empty emoji="💡" title={inbox ? "No suggestions yet" : "You haven't sent any ideas yet"} />
      ) : (
        items.map((s) => (
          <article key={s.id} className="card p-4">
            <div className="flex items-center justify-between gap-2 text-xs text-black/45">
              <span>{SUGGESTION_CATEGORIES[s.category]} · {timeAgo(s.created_at)}{inbox && s.author && ` · ${s.author.full_name} (grade ${s.author.grade})`}</span>
              <span className={`chip ${STATUS[s.status].cls}`}>{STATUS[s.status].label}</span>
            </div>
            <p className="mt-1.5 font-semibold">{s.title}</p>
            {s.body && <p className="mt-1 text-sm whitespace-pre-wrap text-black/70">{s.body}</p>}
            {s.response && !inbox && <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-900">💬 {s.response}</p>}
            {inbox && <RespondForm id={s.id} status={s.status} response={s.response} />}
          </article>
        ))
      )}
    </div>
  );
}

export default function SuggestionsPage(props: PageProps<"/suggestions">) {
  return (
    <>
      <PageHeader title="Suggestion box" back="/more" />
      <Suspense fallback={<PageSkeleton />}>
        <Suggestions searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
