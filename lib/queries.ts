import "server-only";
import type { createClient } from "@/lib/supabase/server";
import { signImages } from "@/lib/images";

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const POST_FIELDS =
  "id, body, image_path, status, created_at, author_id, author:profiles(id, full_name, avatar, grade), club:clubs(id, name, emoji)" as const;

export type FeedPost = {
  id: string;
  body: string;
  image_path: string | null;
  status: string;
  created_at: string;
  author_id: string;
  author: { id: string; full_name: string; avatar: string; grade: number | null } | null;
  club: { id: string; name: string; emoji: string } | null;
  imageUrl?: string | null;
};

// Loads posts (newest first) with their author, club and photo link.
export async function loadPosts(supabase: Supabase, clubIds: string[], limit = 30): Promise<FeedPost[]> {
  if (clubIds.length === 0) return [];
  const { data } = await supabase
    .from("posts")
    .select(POST_FIELDS)
    .in("club_id", clubIds)
    .neq("status", "removed")
    .order("created_at", { ascending: false })
    .limit(limit);
  const posts = (data ?? []) as FeedPost[];
  const urls = await signImages(supabase, posts.map((p) => p.image_path));
  return posts.map((p) => ({ ...p, imageUrl: p.image_path ? urls.get(p.image_path) : undefined }));
}

export const EVENT_FIELDS =
  "id, title, location, starts_at, ends_at, status, club_id, club:clubs(id, name, emoji), event_rsvps(count)" as const;

export type EventSummary = {
  id: string;
  title: string;
  location: string;
  starts_at: string;
  ends_at: string | null;
  status: string;
  club_id: string | null;
  club: { id: string; name: string; emoji: string } | null;
  event_rsvps: { count: number }[];
};
