import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { EVENT_FIELDS, type EventSummary } from "@/lib/queries";
import { fromLocalInput } from "@/lib/time";

// Each helper is cached for the request, so several dashboard cards can ask for
// the same thing and the database is only asked once.

export type MyClub = { id: string; name: string; emoji: string; role: string; members: number };

export const getMyClubs = cache(async (meId: string): Promise<MyClub[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("club_members")
    .select("role, club:clubs(id, name, emoji, status, club_members(count))")
    .eq("profile_id", meId);
  const clubs: MyClub[] = [];
  for (const row of data ?? []) {
    const c = row.club as { id: string; name: string; emoji: string; status: string; club_members: { count: number }[] } | null;
    if (c && c.status === "approved") clubs.push({ id: c.id, name: c.name, emoji: c.emoji, role: row.role, members: c.club_members?.[0]?.count ?? 0 });
  }
  return clubs.sort((a, b) => a.name.localeCompare(b.name));
});

export const getUpcomingEvents = cache(async (): Promise<EventSummary[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select(EVENT_FIELDS)
    .eq("status", "approved")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at")
    .limit(40);
  return (data ?? []) as EventSummary[];
});

const pad = (n: number) => String(n).padStart(2, "0");

export const getMonthEvents = cache(async (year: number, month: number): Promise<{ id: string; starts_at: string }[]> => {
  const supabase = await createClient();
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const from = fromLocalInput(`${year}-${pad(month)}-01T00:00`)!;
  const to = fromLocalInput(`${nextYear}-${pad(nextMonth)}-01T00:00`)!;
  const { data } = await supabase
    .from("events")
    .select("id, starts_at")
    .eq("status", "approved")
    .gte("starts_at", from.toISOString())
    .lt("starts_at", to.toISOString());
  return data ?? [];
});

export type RecentChat = {
  id: string;
  href: string;
  kind: string;
  name: string;
  avatar: string | null;
  emoji: string | null;
  preview: string;
  at: string | null;
  unread: boolean;
};

export const getRecentChats = cache(async (meId: string, limit = 3): Promise<RecentChat[]> => {
  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("conversation_members")
    .select("last_read_at, conversation:conversations(id, kind, last_message_at, club:clubs(id, name, emoji))")
    .eq("profile_id", meId);

  const conversations = (mine ?? [])
    .filter((m) => m.conversation)
    .map((m) => ({ ...m.conversation!, lastRead: m.last_read_at }))
    .filter((c) => c.last_message_at)
    .sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""))
    .slice(0, limit);
  if (conversations.length === 0) return [];

  const ids = conversations.map((c) => c.id);
  const directIds = conversations.filter((c) => c.kind === "direct").map((c) => c.id);
  const [{ data: others }, { data: latest }] = await Promise.all([
    directIds.length
      ? supabase.from("conversation_members").select("conversation_id, profile:profiles(id, full_name, avatar)").in("conversation_id", directIds).neq("profile_id", meId)
      : Promise.resolve({ data: [] as { conversation_id: string; profile: { id: string; full_name: string; avatar: string } | null }[] }),
    supabase
      .from("messages")
      .select("conversation_id, body, sender_id, created_at")
      .in("conversation_id", ids)
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .limit(60),
  ]);
  const person = new Map((others ?? []).map((o) => [o.conversation_id, o.profile]));
  const last = new Map<string, { body: string; sender_id: string }>();
  for (const m of latest ?? []) if (!last.has(m.conversation_id)) last.set(m.conversation_id, m);

  return conversations.map((c) => {
    const other = person.get(c.id);
    const msg = last.get(c.id);
    const isClub = c.kind === "club" && !!c.club;
    return {
      id: c.id,
      href: isClub ? `/clubs/${c.club!.id}/chat` : `/messages/${c.id}`,
      kind: c.kind,
      name: isClub ? c.club!.name : (other?.full_name ?? "Chat"),
      avatar: isClub ? null : (other?.avatar ?? "a01"),
      emoji: isClub ? c.club!.emoji : null,
      preview: msg ? `${msg.sender_id === meId ? "You: " : ""}${msg.body}` : "",
      at: c.last_message_at,
      unread: !!c.last_message_at && c.last_message_at > c.lastRead,
    };
  });
});

// A small picture for an event or announcement, chosen from the words in its title.
export function iconFor(text: string): "flask" | "ball" | "heart" | "library" | "bus" | "shield" | "graduation" | "camera" | "gamepad" | "megaphone" | "calendar" {
  const t = text.toLowerCase();
  if (/science|lab|stem|robot/.test(t)) return "flask";
  if (/basketball|football|soccer|sport|match|practice|tournament/.test(t)) return "ball";
  if (/volunteer|charity|community service|donat/.test(t)) return "heart";
  if (/library|book|reading/.test(t)) return "library";
  if (/bus|transport/.test(t)) return "bus";
  if (/council|election|vote/.test(t)) return "shield";
  if (/exam|tawjihi|university|scholar|graduat/.test(t)) return "graduation";
  if (/photo|camera/.test(t)) return "camera";
  if (/gaming|game|chess/.test(t)) return "gamepad";
  return text.length ? "calendar" : "megaphone";
}
