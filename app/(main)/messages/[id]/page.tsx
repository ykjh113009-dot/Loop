import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadChat } from "@/lib/chat";
import { Avatar } from "@/components/avatar";
import { Chat } from "@/components/chat";
import { Icon } from "@/components/icons";
import { PageSkeleton } from "@/components/skeleton";

async function DirectChat({ params }: { params: PageProps<"/messages/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const { data: conversation } = await supabase.from("conversations").select("id, kind, club_id").eq("id", id).maybeSingle();
  if (!conversation) notFound();
  if (conversation.kind === "club") redirect(`/clubs/${conversation.club_id}/chat`);

  const { messages, people } = await loadChat(conversation.id);
  const other = Object.values(people).find((p) => p.id !== me.id);
  const { data: blocks } = await supabase.from("blocks").select("blocked_id").eq("blocker_id", me.id);
  const iBlocked = !!other && (blocks ?? []).some((b) => b.blocked_id === other.id);

  return (
    <>
      <div className="sticky top-12 z-10 -mx-4 -mt-4 mb-2 flex items-center gap-2 border-b border-black/5 bg-[#f5f6f4]/95 px-4 py-2 backdrop-blur">
        <Link href="/messages" className="-ml-2 rounded-full p-2 text-black/60 hover:bg-black/5" aria-label="Back">
          <Icon name="back" />
        </Link>
        {other && (
          <Link href={`/profile/${other.id}`} className="flex min-w-0 items-center gap-2">
            <Avatar avatar={other.avatar} size="sm" />
            <span className="truncate font-semibold">{other.full_name}</span>
            <span className="text-xs text-black/45">Grade {other.grade}</span>
          </Link>
        )}
      </div>
      <p className="mb-2 rounded-xl bg-black/[0.03] px-3 py-2 text-center text-xs text-black/50">
        Private chat. If something feels wrong, tap 🚩 on a message or block this student from their profile.
      </p>
      <Chat
        conversationId={conversation.id}
        meId={me.id}
        schoolId={me.school_id}
        initialMessages={messages}
        initialPeople={people}
        canSend={!me.isSuspended && !iBlocked}
        cannotSendReason={iBlocked ? "You blocked this student. Unblock them from their profile to chat." : "You can't send messages while your account is suspended."}
        showNames={false}
      />
    </>
  );
}

export default function DirectChatPage(props: PageProps<"/messages/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <DirectChat params={props.params} />
    </Suspense>
  );
}
