import Link from "next/link";
import { deletePost } from "@/app/actions/content";
import { Avatar } from "@/components/avatar";
import { LineIcon } from "@/components/line-icon";
import { ReportButton } from "@/components/report-button";
import { timeAgo } from "@/lib/time";
import type { FeedPost } from "@/lib/queries";

// One post in the community feed. Reactions, comments and bookmarks are shown
// but switched off until they are built.
export function FeedPostCard({ post, meId }: { post: FeedPost; meId: string }) {
  const mine = post.author_id === meId;
  return (
    <article className="flex min-w-0 flex-col rounded-2xl border border-brand-700/10 bg-white p-3.5">
      <header className="flex items-start gap-2.5">
        <Link href={`/profile/${post.author_id}`} className="shrink-0">
          <Avatar avatar={post.author?.avatar ?? "a01"} size="md" />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link href={`/profile/${post.author_id}`} className="block truncate text-sm font-semibold hover:underline">
            {post.author?.full_name}
          </Link>
          <p className="truncate text-[11px] text-ink-2">
            {timeAgo(post.created_at)}
            {post.club && (
              <>
                {" · "}
                <Link href={`/clubs/${post.club.id}`} className="hover:underline">{post.club.name}</Link>
              </>
            )}
          </p>
        </div>
        <details className="relative">
          <summary aria-label="Post options" className="flex cursor-pointer list-none rounded-full p-1.5 text-ink-2 hover:bg-brand-50 [&::-webkit-details-marker]:hidden">
            <LineIcon name="dots" className="size-5" strokeWidth={2.6} />
          </summary>
          <div className="absolute right-0 z-10 mt-1 w-32 rounded-xl border border-brand-700/10 bg-white p-1.5 shadow-lg">
            {mine ? (
              <form action={deletePost}>
                <input type="hidden" name="postId" value={post.id} />
                <button className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm text-red-700 hover:bg-red-50">Delete post</button>
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
        <p className="mt-2.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Only you can see this. It&apos;s waiting for a moderator to check it.</p>
      )}
      <p className="mt-2.5 text-sm break-words whitespace-pre-wrap [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:5] overflow-hidden">{post.body}</p>
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- already compressed when uploaded
        <img src={post.imageUrl} alt="" loading="lazy" className="mt-2.5 h-44 w-full rounded-xl bg-black/5 object-cover" />
      )}
      <footer className="mt-auto flex items-center gap-4 pt-3 text-ink-2/60" title="Reactions, comments and bookmarks are coming soon">
        <span className="flex items-center gap-1 text-xs" aria-disabled="true"><LineIcon name="heart" className="size-[18px]" /></span>
        <span className="flex items-center gap-1 text-xs" aria-disabled="true"><LineIcon name="comment" className="size-[18px]" /></span>
        <span className="ml-auto" aria-disabled="true"><LineIcon name="bookmark" className="size-[18px]" /></span>
      </footer>
    </article>
  );
}
