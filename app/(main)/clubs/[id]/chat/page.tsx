import { Suspense } from "react";
import { getClub } from "@/lib/clubs";
import { createClient } from "@/lib/supabase/server";
import { loadChat } from "@/lib/chat";
import { Chat } from "@/components/chat";
import { Empty } from "@/components/empty";
import { PageSkeleton } from "@/components/skeleton";

async function ClubChat({ params }: { params: PageProps<"/clubs/[id]/chat">["params"] }) {
  const { id } = await params;
  const { me, club, isMember } = await getClub(id);
  if (!isMember) {
    return <Empty emoji="💬" title="Members only">Join the club to see and send messages.</Empty>;
  }
  const supabase = await createClient();
  const { data: conversation } = await supabase.from("conversations").select("id").eq("club_id", club.id).maybeSingle();
  if (!conversation) return <Empty emoji="💬" title="This chat isn't ready yet" />;
  const { messages, people } = await loadChat(conversation.id);

  return (
    <Chat
      conversationId={conversation.id}
      meId={me.id}
      schoolId={me.school_id}
      initialMessages={messages}
      initialPeople={people}
      canSend={!me.isSuspended}
      cannotSendReason="You can't send messages while your account is suspended."
      showNames
    />
  );
}

export default function ClubChatPage(props: PageProps<"/clubs/[id]/chat">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ClubChat params={props.params} />
    </Suspense>
  );
}
