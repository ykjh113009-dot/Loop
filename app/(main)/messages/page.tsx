import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import { Avatar } from "@/components/avatar";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Chats" };

async function Conversations() {
  const me = await requireMe();
  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("conversation_members")
    .select("last_read_at, conversation:conversations(id, kind, last_message_at, club:clubs(id, name, emoji))")
    .eq("profile_id", me.id);

  const conversations = (mine ?? [])
    .filter((m) => m.conversation)
    .map((m) => ({ ...m.conversation!, lastRead: m.last_read_at }))
    .sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));
  const ids = conversations.map((c) => c.id);

  const [{ data: others }, { data: latest }] = await Promise.all([
    supabase
      .from("conversation_members")
      .select("conversation_id, profile:profiles(id, full_name, avatar)")
      .in("conversation_id", conversations.filter((c) => c.kind === "direct").map((c) => c.id))
      .neq("profile_id", me.id),
    supabase
      .from("messages")
      .select("conversation_id, body, sender_id, created_at")
      .in("conversation_id", ids)
      .eq("status", "visible")
      .order("created_at", { ascending: false })
      .limit(300),
  ]);
  const otherPerson = new Map((others ?? []).map((o) => [o.conversation_id, o.profile]));
  const lastMessage = new Map<string, { body: string; sender_id: string }>();
  for (const m of latest ?? []) if (!lastMessage.has(m.conversation_id)) lastMessage.set(m.conversation_id, m);

  if (conversations.length === 0) {
    return (
      <Empty emoji="💬" title="No chats yet">
        Join a club to use its group chat, or open a student&apos;s profile and tap Message.
      </Empty>
    );
  }

  return (
    <ul className="card divide-y divide-black/5">
      {conversations.map((c) => {
        const other = otherPerson.get(c.id);
        const last = lastMessage.get(c.id);
        const unread = !!c.last_message_at && c.last_message_at > c.lastRead;
        const href = c.kind === "club" && c.club ? `/clubs/${c.club.id}/chat` : `/messages/${c.id}`;
        return (
          <li key={c.id}>
            <Link href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02]">
              {c.kind === "club" ? (
                <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xl">{c.club?.emoji}</div>
              ) : (
                <Avatar avatar={other?.avatar ?? "a01"} />
              )}
              <div className="min-w-0 flex-1">
                <p className={`truncate ${unread ? "font-bold" : "font-medium"}`}>
                  {c.kind === "club" ? c.club?.name : other?.full_name}
                </p>
                <p className={`truncate text-sm ${unread ? "text-black/80" : "text-black/50"}`}>
                  {last ? `${last.sender_id === me.id ? "You: " : ""}${last.body}` : "No messages yet"}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-black/40">
                {c.last_message_at && timeAgo(c.last_message_at)}
                {unread && <span className="mt-1 ml-auto block size-2.5 rounded-full bg-brand-600" />}
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export default function MessagesPage() {
  return (
    <>
      <PageHeader title="Chats" />
      <Suspense fallback={<PageSkeleton />}>
        <Conversations />
      </Suspense>
    </>
  );
}
