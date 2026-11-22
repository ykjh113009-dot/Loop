import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadFeed } from "@/lib/feed";
import { getT } from "@/lib/i18n-server";
import { timeAgo } from "@/lib/time";
import { addComment, deleteComment } from "@/app/actions/feed";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { ReportButton } from "@/components/report-button";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";
import { FeedPostCard } from "@/components/dashboard/feed-post";
import { RichText } from "@/components/feed/rich-text";

export const metadata = { title: "Post" };

type Comment = {
  id: string; parent_id: string | null; author_id: string; body: string; status: string; created_at: string;
  author: { id: string; full_name: string; avatar: string } | null;
};

async function Post({ params }: { params: PageProps<"/post/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const [[post], { data }] = await Promise.all([
    loadFeed(supabase, me.id, { ids: [id] }),
    supabase
      .from("post_comments")
      .select("id, parent_id, author_id, body, status, created_at, author:profiles!post_comments_author_id_fkey(id, full_name, avatar)")
      .eq("post_id", id).neq("status", "removed").order("created_at").limit(500),
  ]);
  if (!post) notFound();
  const comments = (data ?? []) as Comment[];
  const top = comments.filter((c) => !c.parent_id);
  const canWrite = !me.isSuspended && post.status === "visible";

  const one = (c: Comment, reply: boolean) => (
    <div key={c.id} className={`flex gap-2.5 ${reply ? "ms-10" : ""}`} data-comment={c.id}>
      <Link href={`/profile/${c.author_id}`} className="shrink-0" aria-label={c.author?.full_name ?? undefined}><Avatar avatar={c.author?.avatar ?? "a01"} size="sm" /></Link>
      <div className="min-w-0 flex-1">
        <div className="rounded-2xl bg-brand-50/70 px-3 py-2">
          <Link href={`/profile/${c.author_id}`} className="text-sm font-semibold hover:underline">{c.author?.full_name}</Link>
          {c.status === "held" && <p className="text-xs text-amber-800">{t("Only you can see this. It's waiting for a moderator to check it.")}</p>}
          <p className="text-sm break-words whitespace-pre-wrap"><RichText text={c.body} /></p>
        </div>
        <div className="mt-0.5 flex items-center gap-3 ps-3 text-[11px] text-ink-2">
          <span>{timeAgo(c.created_at)}</span>
          {c.author_id === me.id ? (
            <form action={deleteComment}>
              <input type="hidden" name="commentId" value={c.id} />
              <button className="hover:underline">{t("Delete")}</button>
            </form>
          ) : (
            <ReportButton targetType="comment" targetId={c.id} compact />
          )}
        </div>
        {!reply && canWrite && (
          <details className="mt-1 ps-3">
            <summary className="cursor-pointer text-[11px] font-semibold text-brand-700">{t("Reply")}</summary>
            <ActionForm action={addComment} className="mt-1 flex gap-2">
              <input type="hidden" name="postId" value={post.id} />
              <input type="hidden" name="parentId" value={c.id} />
              <input name="body" required maxLength={1000} placeholder={t("Write a reply…")} aria-label={t("Write a reply…")} className="input flex-1 py-2 text-sm" />
              <SubmitButton className="btn-primary px-3 py-2 text-sm" pendingText="…">{t("Reply")}</SubmitButton>
            </ActionForm>
          </details>
        )}
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t("Post")} back="/home" />
      <FeedPostCard post={post} meId={me.id} locale={locale} full />
      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">{t("Comments")} <span className="font-normal text-ink-2">({post.comment_count})</span></h2>
        {canWrite && (
          <ActionForm action={addComment} className="flex gap-2">
            <input type="hidden" name="postId" value={post.id} />
            <input name="body" required maxLength={1000} placeholder={t("Write a comment…")} aria-label={t("Write a comment…")} className="input flex-1" />
            <SubmitButton className="btn-primary" pendingText="…">{t("Send")}</SubmitButton>
          </ActionForm>
        )}
        {top.length === 0 && <p className="text-sm text-ink-2">{t("No comments yet.")}</p>}
        {top.map((c) => (
          <div key={c.id} className="space-y-2">
            {one(c, false)}
            {comments.filter((r) => r.parent_id === c.id).map((r) => one(r, true))}
          </div>
        ))}
      </section>
    </div>
  );
}

export default function PostPage(props: PageProps<"/post/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Post params={props.params} />
    </Suspense>
  );
}
