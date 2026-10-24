import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { ReportButton } from "@/components/report-button";
import { deletePost } from "@/app/actions/content";
import { timeAgo } from "@/lib/time";
import type { FeedPost } from "@/lib/queries";

export function PostCard({ post, meId, showClub = true }: { post: FeedPost; meId: string; showClub?: boolean }) {
  const mine = post.author_id === meId;
  return (
    <article className="card p-4">
      <header className="flex items-start gap-3">
        <Link href={`/profile/${post.author_id}`}>
          <Avatar avatar={post.author?.avatar ?? "a01"} />
        </Link>
        <div className="min-w-0 flex-1 text-sm">
          <Link href={`/profile/${post.author_id}`} className="font-semibold hover:underline">
            {post.author?.full_name}
          </Link>
          <span className="text-black/45"> · Grade {post.author?.grade} · {timeAgo(post.created_at)}</span>
          {showClub && post.club && (
            <Link href={`/clubs/${post.club.id}`} className="block truncate text-xs text-brand-700 hover:underline">
              {post.club.emoji} {post.club.name}
            </Link>
          )}
        </div>
        {mine ? (
          <form action={deletePost}>
            <input type="hidden" name="postId" value={post.id} />
            <button className="text-xs text-black/40 hover:text-red-600">Delete</button>
          </form>
        ) : (
          <ReportButton targetType="post" targetId={post.id} compact />
        )}
      </header>
      {post.status === "held" && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Only you can see this. It&apos;s waiting for a moderator to check it.
        </p>
      )}
      <p className="mt-3 break-words whitespace-pre-wrap">{post.body}</p>
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- already compressed when uploaded
        <img src={post.imageUrl} alt="" loading="lazy" className="mt-3 max-h-96 w-full rounded-xl bg-black/5 object-cover" />
      )}
    </article>
  );
}
