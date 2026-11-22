import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadChat } from "@/lib/chat";
import { getT } from "@/lib/i18n-server";
import { leaveGroup, respondMessageRequest } from "@/app/actions/messages";
import { Avatar } from "@/components/avatar";
import { Chat } from "@/components/chat";
import { Icon } from "@/components/icons";
import { PageSkeleton } from "@/components/skeleton";
import { Glyph } from "@/components/glyph";
import { GroupPhotoButton } from "@/components/group-photo-button";
import { signGroupImages } from "@/lib/images";

async function DirectChat({ params }: { params: PageProps<"/messages/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data: conversation } = await supabase.from("conversations").select("id, kind, club_id, title, image_path, created_by").eq("id", id).maybeSingle();
  if (!conversation) notFound();
  if (conversation.kind === "club") redirect(`/clubs/${conversation.club_id}/chat`);

  const [{ messages, people, reactions }, { data: blocks }, { data: members }] = await Promise.all([
    loadChat(conversation.id),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", me.id),
    supabase.from("conversation_members").select("profile_id, accepted_at").eq("conversation_id", conversation.id),
  ]);
  const groupImage = conversation.image_path ? (await signGroupImages(supabase, [conversation.image_path])).get(conversation.image_path) ?? null : null;
  const canEditPhoto = conversation.kind === "group" && (conversation.created_by === me.id || me.isAdmin);
  const group = conversation.kind === "group" || conversation.kind === "groupchat" || conversation.kind === "eventchat";
  const other = group ? undefined : Object.values(people).find((p) => p.id !== me.id);
  const iBlocked = !!other && (blocks ?? []).some((b) => b.blocked_id === other.id);
  const myRequest = (members ?? []).some((m) => m.profile_id === me.id && !m.accepted_at);
  const theirRequest = (members ?? []).some((m) => m.profile_id !== me.id && !m.accepted_at);
  const waiting = theirRequest && messages.some((m) => m.sender_id === me.id);

  return (
    <>
      <div className="mb-3 flex items-center gap-3 rounded-3xl border border-brand-700/10 bg-white/70 px-4 py-3" data-chat-header>
        <Link href="/messages" className="-ms-2 rounded-full p-2 text-black/60 hover:bg-black/5 lg:hidden rtl:-scale-x-100" aria-label={t("Back")}>
          <Icon name="back" />
        </Link>
        {group ? (
          <>
            <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-700 text-white" data-group-photo>
              {groupImage
                // eslint-disable-next-line @next/next/no-img-element -- signed private image
                ? <img src={groupImage} alt="" className="size-full object-cover" />
                : <Glyph e="👥" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-heading text-xl font-semibold text-brand-900">{conversation.title}</span>
              <span className="block truncate text-sm text-black/50">{t("{n} members", { n: Object.keys(people).length })}</span>
              {canEditPhoto && <GroupPhotoButton conversationId={conversation.id} schoolId={me.school_id} hasPhoto={!!groupImage} locale={locale} />}
            </span>
            {conversation.kind === "group" && (
              <form action={leaveGroup}>
                <input type="hidden" name="conversationId" value={conversation.id} />
                <button className="btn-ghost px-2 py-1 text-xs">{t("Leave")}</button>
              </form>
            )}
          </>
        ) : other && (
          <Link href={`/profile/${other.id}`} className="flex min-w-0 items-center gap-3">
            <Avatar avatar={other.avatar} className="size-14" />
            <span className="min-w-0">
              <span className="block truncate font-heading text-xl font-semibold text-brand-900">{other.full_name}</span>
              {other.grade && <span className="block text-sm text-black/50">{t("Grade {n}", { n: other.grade })}</span>}
            </span>
          </Link>
        )}
      </div>
      {myRequest ? (
        <div className="card mb-3 space-y-2 p-4 text-center">
          <p className="font-semibold">{t("{name} wants to message you", { name: other?.full_name ?? "" })}</p>
          <p className="text-sm text-black/55">{t("They are not on your friends list. They cannot write again until you accept.")}</p>
          <form action={respondMessageRequest} className="flex justify-center gap-2">
            <input type="hidden" name="conversationId" value={conversation.id} />
            <button name="decision" value="accept" className="btn-primary">{t("Accept")}</button>
            <button name="decision" value="decline" className="btn-secondary">{t("Decline")}</button>
          </form>
        </div>
      ) : (
        <p className="mb-2 rounded-xl bg-black/[0.03] px-3 py-2 text-center text-xs text-black/50">
          {group
            ? t("Group chat. If something feels wrong, tap the flag on a message.")
            : t("Private chat. If something feels wrong, tap the flag on a message or block this student from their profile.")}
        </p>
      )}
      <Chat
        conversationId={conversation.id}
        meId={me.id}
        schoolId={me.school_id}
        initialMessages={messages}
        initialPeople={people}
        initialReactions={reactions}
        locale={locale}
        requestPending={theirRequest}
        canSend={!me.isSuspended && !iBlocked && !myRequest && !waiting}
        cannotSendReason={
          iBlocked ? t("You blocked this student. Unblock them from their profile to chat.")
          : myRequest ? t("Accept the request to reply.")
          : waiting ? t("Your message request was sent. You can write again once it is accepted.")
          : t("You can't send messages while your account is suspended.")
        }
        showNames={group}
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
