import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ChatPerson = { id: string; full_name: string; avatar: string; grade: number | null };
export type ChatMessage = { id: string; sender_id: string; body: string; status: string; created_at: string };

// The last 100 messages of a chat plus everyone in it.
export async function loadChat(conversationId: string) {
  const supabase = await createClient();
  const [{ data: messages }, { data: members }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, sender_id, body, status, created_at")
      .eq("conversation_id", conversationId)
      .neq("status", "removed")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("conversation_members")
      .select("profile:profiles(id, full_name, avatar, grade)")
      .eq("conversation_id", conversationId),
  ]);
  const people: Record<string, ChatPerson> = {};
  for (const m of members ?? []) if (m.profile) people[m.profile.id] = m.profile;
  return { messages: ((messages ?? []) as ChatMessage[]).reverse(), people };
}
