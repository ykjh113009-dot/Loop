import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { signImages } from "@/lib/images";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const REACTIONS = { like: "👍", love: "❤️", laugh: "😂", wow: "😮", sad: "😢", clap: "👏" } as const;
export type ReactionKind = keyof typeof REACTIONS;

const FIELDS =
  "id, body, image_path, status, created_at, author_id, club_id, kind, repost_of, reaction_count, comment_count, author:profiles!posts_author_id_fkey(id, full_name, avatar, handle, grade, section, role), club:clubs(id, name, emoji)" as const;

export type FeedItem = {
  id: string;
  body: string;
  image_path: string | null;
  status: string;
  created_at: string;
  author_id: string;
  club_id: string | null;
  kind: string;
  repost_of: string | null;
  reaction_count: number;
  comment_count: number;
  author: { id: string; full_name: string; avatar: string; handle: string | null; grade: number | null; section: string | null; role: string } | null;
  club: { id: string; name: string; emoji: string } | null;
  imageUrl?: string;
  myReaction: ReactionKind | null;
  saved: boolean;
  poll: { idx: number; label: string; votes: number; mine: boolean }[];
  original: { id: string; body: string; imageUrl?: string; author: { id: string; full_name: string; avatar: string } | null } | null;
};

type Source =
  | { feed: true; tag?: string | null; limit: number; offset?: number }
  | { authorId: string; limit: number }
  | { ids: string[] };

// Loads posts with everything a card needs: author, photo link, poll totals,
// the viewer's own reaction and bookmark, and the original of a shared post.
export async function loadFeed(supabase: Supabase, meId: string, source: Source): Promise<FeedItem[]> {
  let rows: unknown[] | null = null;
  if ("feed" in source) {
    const { data } = await supabase
      .rpc("feed_posts", { p_limit: source.limit, p_offset: source.offset ?? 0, p_tag: (source.tag ?? null) as unknown as string })
      .select(FIELDS);
    rows = data;
  } else if ("authorId" in source) {
    const { data } = await supabase
      .from("posts").select(FIELDS).eq("author_id", source.authorId).neq("status", "removed")
      .order("created_at", { ascending: false }).limit(source.limit);
    rows = data;
  } else {
    if (source.ids.length === 0) return [];
    const { data } = await supabase.from("posts").select(FIELDS).in("id", source.ids).neq("status", "removed");
    const order = new Map(source.ids.map((id, i) => [id, i]));
    rows = (data ?? []).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
  }
  const posts = (rows ?? []) as Omit<FeedItem, "myReaction" | "saved" | "poll" | "original">[];
  if (posts.length === 0) return [];

  const ids = posts.map((p) => p.id);
  const pollIds = posts.filter((p) => p.kind === "poll").map((p) => p.id);
  const originalIds = [...new Set(posts.map((p) => p.repost_of).filter((x): x is string => !!x))];
  const [{ data: reactions }, { data: saves }, { data: polls }, { data: originals }] = await Promise.all([
    supabase.from("post_reactions").select("post_id, kind").eq("profile_id", meId).in("post_id", ids),
    supabase.from("post_saves").select("post_id").eq("profile_id", meId).in("post_id", ids),
    pollIds.length ? supabase.rpc("post_poll_results", { p_posts: pollIds }) : Promise.resolve({ data: [] }),
    originalIds.length
      ? supabase.from("posts").select("id, body, image_path, author:profiles!posts_author_id_fkey(id, full_name, avatar)").in("id", originalIds).eq("status", "visible")
      : Promise.resolve({ data: [] }),
  ]);
  const urls = await signImages(supabase, [...posts.map((p) => p.image_path), ...(originals ?? []).map((o) => o.image_path)]);
  const mine = new Map((reactions ?? []).map((r) => [r.post_id, r.kind as ReactionKind]));
  const saved = new Set((saves ?? []).map((s) => s.post_id));

  return posts.map((p) => {
    const o = (originals ?? []).find((x) => x.id === p.repost_of);
    return {
      ...p,
      imageUrl: (p.image_path && urls.get(p.image_path)) || undefined,
      myReaction: mine.get(p.id) ?? null,
      saved: saved.has(p.id),
      poll: (polls ?? []).filter((x) => x.post_id === p.id).map((x) => ({ idx: x.idx, label: x.label, votes: Number(x.votes), mine: x.mine })),
      original: o ? { id: o.id, body: o.body, imageUrl: (o.image_path && urls.get(o.image_path)) || undefined, author: o.author } : null,
    };
  });
}
