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

function PostMenu({ post, mine, t }: { post: FeedItem; mine: boolean; t: (s: string) => string }) {
  return (
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
          <div className="px-1 py-0.5"><ReportButton targetType="post" targetId={post.id} /></div>
        )}
      </div>
    </details>
  );
}

// One post: who, what, photo or poll, and the reaction row.
export function FeedPostCard({ post, meId, locale = "en", full = false, wide = false }: { post: FeedItem; meId: string; locale?: Locale; full?: boolean; wide?: boolean }) {
  const t = makeT(locale);
  const mine = post.author_id === meId;
  const badge = KIND_BADGE[post.kind];
  if (wide) {
    const isPoll = post.kind === "poll";
    return (
      <article className={`min-w-0 rounded-3xl border border-brand-700/10 p-4 shadow-[0_1px_2px_rgba(40,60,40,0.04)] sm:p-5 ${isPoll ? "bg-sage-soft/50" : "bg-white/85"}`} data-post={post.id}>
        <div className="flex gap-3.5 sm:gap-4">
          <Link href={`/profile/${post.author_id}`} className="shrink-0">
            <Avatar avatar={post.author?.avatar ?? "a01"} size="md" className="!size-12 sm:!size-14" />
          </Link>
          <div className="min-w-0 flex-1">
            <header className="flex items-start gap-2">
              <p className="min-w-0 flex-1 truncate text-[15px] leading-tight">
                <Link href={`/profile/${post.author_id}`} className="font-semibold hover:underline">{post.author?.full_name}</Link>
                {post.author?.handle && <span className="text-ink-2"> @{post.author.handle}</span>}
                <span className="text-ink-2"> · </span>
                <Link href={`/post/${post.id}`} className="text-ink-2 hover:underline">{timeAgo(post.created_at)}</Link>
                {post.club && <span className="text-ink-2"> · <Link href={`/clubs/${post.club.id}`} className="hover:underline">{post.club.name}</Link></span>}
              </p>
              {badge && <span className={`chip shrink-0 ${badge.className}`}>{t(badge.label)}</span>}
              <PostMenu post={post} mine={mine} t={t} />
            </header>
            {post.status === "held" && (
              <p className="mt-2.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{t("Only you can see this. It's waiting for a moderator to check it.")}</p>
            )}
            <div className="mt-1.5 sm:flex sm:items-start sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className={`text-[16px] leading-relaxed break-words whitespace-pre-wrap ${isPoll ? "font-semibold" : ""}`}><RichText text={post.body} /></p>
                {isPoll && post.poll.length > 0 && <PollBox postId={post.id} options={post.poll} locale={locale} wide />}
                {post.kind === "repost" && post.original && (
                  <Link href={`/post/${post.original.id}`} className="mt-2.5 block rounded-2xl border border-brand-700/10 bg-brand-50/50 p-3 hover:bg-brand-50">
                    <span className="flex items-center gap-2 text-xs font-semibold"><Avatar avatar={post.original.author?.avatar ?? "a01"} size="xs" />{post.original.author?.full_name}</span>
                    <span className="mt-1 block text-sm break-words whitespace-pre-wrap [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4] overflow-hidden">{post.original.body}</span>
                  </Link>
                )}
                {post.kind === "repost" && !post.original && <p className="mt-2.5 rounded-xl bg-black/[0.04] px-3 py-2 text-xs text-ink-2">{t("The original post is no longer available.")}</p>}
              </div>
              {post.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- already compressed when uploaded
                <img src={post.imageUrl} alt="" loading="lazy" className="mt-3 h-44 w-full rounded-2xl bg-black/5 object-cover sm:mt-0 sm:h-[130px] sm:w-[210px] sm:shrink-0" />
              )}
            </div>
            <PostActions
              postId={post.id}
              reactionCount={post.reaction_count}
              commentCount={post.comment_count}
              myReaction={post.myReaction}
              saved={post.saved}
              canShare={!post.club_id && post.kind !== "repost" && post.status === "visible" && !mine}
              locale={locale}
              pills
            />
          </div>
        </div>
      </article>
    );
  }
  return (
    <article className={`flex min-w-0 flex-col rounded-2xl border border-brand-700/10 bg-white shadow-[0_1px_2px_rgba(40,60,40,0.04)] ${wide ? "p-5" : "p-3.5"}`} data-post={post.id}>
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
      <p className={`mt-3 ${wide ? "text-[15px] leading-relaxed" : "text-sm"} break-words whitespace-pre-wrap ${full ? "" : "[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:6] overflow-hidden"}`}>
        <RichText text={post.body} />
      </p>
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- already compressed when uploaded
        <img src={post.imageUrl} alt="" loading="lazy" className={`mt-2.5 w-full rounded-xl bg-black/5 object-cover ${full || wide ? "max-h-[34rem]" : "h-44"}`} />
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
