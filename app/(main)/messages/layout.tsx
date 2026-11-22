import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signClubImages, signGroupImages } from "@/lib/images";
import { timeAgo } from "@/lib/time";
import { getT } from "@/lib/i18n-server";
import { ChatList, type ChatItem } from "@/components/chat-list";

async function List() {
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data: mine } = await supabase
    .from("conversation_members")
    .select("last_read_at, accepted_at, conversation:conversations(id, kind, title, image_path, last_message_at, club:clubs(id, name, emoji, image_path))")
    .eq("profile_id", me.id);
  const conversations = (mine ?? [])
    .filter((m) => m.conversation)
    .map((m) => ({ ...m.conversation!, lastRead: m.last_read_at, request: !m.accepted_at }))
    .sort((a, b) => (b.last_message_at ?? "").localeCompare(a.last_message_at ?? ""));
  const ids = conversations.map((c) => c.id);
  const clubImages = await signClubImages(supabase, conversations.map((c) => c.club?.image_path ?? null));
  const groupImages = await signGroupImages(supabase, conversations.map((c) => (c.kind === "group" ? c.image_path : null)));
  const [{ data: others }, { data: latest }] = await Promise.all([
    supabase.from("conversation_members").select("conversation_id, profile:profiles(id, full_name, avatar)")
      .in("conversation_id", conversations.filter((c) => c.kind === "direct").map((c) => c.id)).neq("profile_id", me.id),
    supabase.from("messages").select("conversation_id, body, sender_id, created_at").in("conversation_id", ids).eq("status", "visible").order("created_at", { ascending: false }).limit(300),
  ]);
  const otherPerson = new Map((others ?? []).map((o) => [o.conversation_id, o.profile]));
  const lastMessage = new Map<string, { body: string; sender_id: string }>();
  for (const m of latest ?? []) if (!lastMessage.has(m.conversation_id)) lastMessage.set(m.conversation_id, m);

  const items: ChatItem[] = conversations.map((c) => {
    const other = otherPerson.get(c.id);
    const last = lastMessage.get(c.id);
    const kind = c.kind === "direct" ? "direct" : c.kind === "club" && c.club ? "club" : "group";
    return {
      id: c.id,
      href: c.kind === "club" && c.club ? `/clubs/${c.club.id}/chat` : `/messages/${c.id}`,
      title: (kind === "club" ? c.club?.name : kind === "group" ? c.title : other?.full_name) ?? "",
      preview: last ? `${last.sender_id === me.id ? t("You: ") : ""}${last.body || t("Attachment")}` : t("No messages yet"),
      time: c.last_message_at ? timeAgo(c.last_message_at) : "",
      unread: !!c.last_message_at && c.last_message_at > c.lastRead,
      request: c.request,
      kind,
      avatar: other?.avatar,
      emoji: c.club?.emoji,
      imageUrl: kind === "club" ? (c.club?.image_path ? clubImages.get(c.club.image_path) : null) : kind === "group" && c.image_path ? groupImages.get(c.image_path) ?? null : null,
    };
  });
  return <ChatList items={items} locale={locale} />;
}

// The chat screen: your conversations on one side, the open chat on the other (one at a time on phones).
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gap-5 lg:grid lg:grid-cols-[360px_minmax(0,1fr)]" data-wide data-chat-shell>
      <Suspense fallback={<div className="hidden h-64 rounded-3xl bg-white/60 lg:block" />}>
        <List />
      </Suspense>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
