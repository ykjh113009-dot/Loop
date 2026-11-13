import Link from "next/link";
import { deletePost } from "@/app/actions/content";
import { Avatar } from "@/components/avatar";
import { LineIcon } from "@/components/line-icon";
import { ReportButton } from "@/components/report-button";
import { PollBox } from "@/components/feed/poll-box";
import { PostActions } from "@/components/feed/post-actions";
import { RichText } from "@/components/feed/rich-text";
import { timeAgo } from "@/lib/time";
import { makeT, type Locale } from "@/lib/i18n";
import type { FeedItem } from "@/lib/feed";

const KIND_BADGE: Record<string, { label: string; className: string }> = {
  question: { label: "Question", className: "bg-sky text-ink" },
  achievement: { label: "Achievement", className: "bg-amber-100 text-amber-900" },
  poll: { label: "Poll", className: "bg-brand-100 text-brand-900" },
};

// One post: who, what, photo or poll, and the reaction row.
export function FeedPostCard({ post, meId, locale = "en", full = false }: { post: FeedItem; meId: string; locale?: Locale; full?: boolean }) {
  const t = makeT(locale);
  const mine = post.author_id === meId;
  const badge = KIND_BADGE[post.kind];
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-brand-700/10 bg-white p-3.5" data-post={post.id}>
      <header className="flex items-start gap-2.5">
        <Link href={`/profile/${post.author_id}`} className="shrink-0">
          <Avatar avatar={post.author?.avatar ?? "a01"} size="md" />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link href={`/profile/${post.author_id}`} className="block truncate text-sm font-semibold hover:underline">
            {post.author?.full_name}
          </Link>
          <p className="truncate text-[11px] text-ink-2">
            <Link href={`/post/${post.id}`} className="hover:underline">{timeAgo(post.created_at)}</Link>
            {" · "}
            {post.club ? <Link href={`/clubs/${post.club.id}`} className="hover:underline">{post.club.name}</Link> : t("Whole school")}
          </p>
        </div>
        {badge && <span className={`chip shrink-0 ${badge.className}`}>{t(badge.label)}</span>}
        <details className="relative">
          <summary aria-label={t("Post options")} className="flex cursor-pointer list-none rounded-full p-1.5 text-ink-2 hover:bg-brand-50 [&::-webkit-details-marker]:hidden">
            <LineIcon name="dots" className="size-5" strokeWidth={2.6} />
          </summary>
          <div className="absolute end-0 z-10 mt-1 w-32 rounded-xl border border-brand-700/10 bg-white p-1.5 shadow-lg">
            {mine ? (
              <form action={deletePost}>
                <input type="hidden" name="postId" value={post.id} />
                <button className="w-full rounded-lg px-2.5 py-1.5 text-start text-sm text-red-700 hover:bg-red-50">{t("Delete post")}</button>
              </form>
            ) : (
              <div className="px-1 py-0.5">
                <ReportButton targetType="post" targetId={post.id} />
              </div>
            )}
          </div>
        </details>
      </header>
      {post.status === "held" && (
        <p className="mt-2.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{t("Only you can see this. It's waiting for a moderator to check it.")}</p>
      )}
      <p className={`mt-2.5 text-sm break-words whitespace-pre-wrap ${full ? "" : "[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:6] overflow-hidden"}`}>
        <RichText text={post.body} />
      </p>
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- already compressed when uploaded
        <img src={post.imageUrl} alt="" loading="lazy" className={`mt-2.5 w-full rounded-xl bg-black/5 object-cover ${full ? "max-h-[32rem]" : "h-44"}`} />
      )}
      {post.kind === "poll" && post.poll.length > 0 && <PollBox postId={post.id} options={post.poll} locale={locale} />}
      {post.kind === "repost" && (
        post.original ? (
          <Link href={`/post/${post.original.id}`} className="mt-2.5 block rounded-xl border border-brand-700/10 bg-brand-50/50 p-3 hover:bg-brand-50">
            <span className="flex items-center gap-2 text-xs font-semibold">
              <Avatar avatar={post.original.author?.avatar ?? "a01"} size="xs" />
              {post.original.author?.full_name}
            </span>
            <span className="mt-1 block text-sm break-words whitespace-pre-wrap [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4] overflow-hidden">{post.original.body}</span>
          </Link>
        ) : (
          <p className="mt-2.5 rounded-xl bg-black/[0.04] px-3 py-2 text-xs text-ink-2">{t("The original post is no longer available.")}</p>
        )
      )}
      <PostActions
        postId={post.id}
        reactionCount={post.reaction_count}
        commentCount={post.comment_count}
        myReaction={post.myReaction}
        saved={post.saved}
        canShare={!post.club_id && post.kind !== "repost" && post.status === "visible" && !mine}
        locale={locale}
      />
    </article>
  );
}
