"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { connectRealtime, createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { ReportButton } from "@/components/report-button";
import { formatDate, formatTime, localDayKey } from "@/lib/time";
import type { ChatMessage, ChatPerson } from "@/lib/chat";

export function Chat({
  conversationId,
  meId,
  schoolId,
  initialMessages,
  initialPeople,
  canSend,
  cannotSendReason,
  showNames,
}: {
  conversationId: string;
  meId: string;
  schoolId: string;
  initialMessages: ChatMessage[];
  initialPeople: Record<string, ChatPerson>;
  canSend: boolean;
  cannotSendReason?: string;
  showNames: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [people, setPeople] = useState(initialPeople);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  const add = (m: ChatMessage) =>
    setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));

  // New messages appear live, and the chat is marked as read.
  useEffect(() => {
    const supabase = createClient();
    const markRead = () =>
      supabase
        .from("conversation_members")
        .update({ last_read_at: new Date().toISOString() })
        .eq("conversation_id", conversationId)
        .eq("profile_id", meId)
        .then(() => {});
    markRead();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let stopped = false;
    connectRealtime().then(() => {
      if (stopped) return;
      channel = supabase
        .channel(`chat:${conversationId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
          (payload) => {
            const m = payload.new as ChatMessage;
            if (m.status === "visible" || m.sender_id === meId) {
              add(m);
              markRead();
            }
          },
        )
        .subscribe();
    });
    return () => {
      stopped = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [conversationId, meId]);

  // Someone who joined the club after the page loaded: look them up.
  useEffect(() => {
    const unknown = [...new Set(messages.map((m) => m.sender_id))].filter((id) => !people[id]);
    if (unknown.length === 0) return;
    createClient()
      .from("profiles")
      .select("id, full_name, avatar, grade")
      .in("id", unknown)
      .then(({ data }) => data && setPeople((p) => ({ ...p, ...Object.fromEntries(data.map((d) => [d.id, d])) })));
  }, [messages, people]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    const { data, error } = await createClient()
      .from("messages")
      .insert({ conversation_id: conversationId, sender_id: meId, body, school_id: schoolId })
      .select("id, sender_id, body, status, created_at")
      .single();
    setSending(false);
    if (error) {
      setError("Your message wasn't sent. Please try again.");
      return;
    }
    setText("");
    add(data);
  }

  return (
    <div className="flex min-h-[60dvh] flex-col">
      <div className="flex-1 space-y-1 pb-4">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-black/45">No messages yet. Say hi! 👋</p>}
        {messages.map((m, i) => {
          const mine = m.sender_id === meId;
          const person = people[m.sender_id];
          const prev = messages[i - 1];
          const newDay = !prev || localDayKey(prev.created_at) !== localDayKey(m.created_at);
          const sameSender = !newDay && prev?.sender_id === m.sender_id;
          return (
            <div key={m.id}>
              {newDay && <p className="py-3 text-center text-xs font-medium text-black/40">{formatDate(m.created_at)}</p>}
              <div className={`group flex items-end gap-2 ${mine ? "flex-row-reverse" : ""} ${sameSender ? "" : "pt-2"}`}>
                {!mine && (
                  <Link href={`/profile/${m.sender_id}`} className={sameSender ? "invisible" : ""}>
                    <Avatar avatar={person?.avatar ?? "a01"} size="sm" />
                  </Link>
                )}
                <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  {showNames && !mine && !sameSender && (
                    <span className="mb-0.5 px-1 text-xs font-medium text-black/50">{person?.full_name ?? "…"}</span>
                  )}
                  <div
                    className={`rounded-2xl px-3 py-2 break-words whitespace-pre-wrap ${
                      mine ? "rounded-br-md bg-brand-700 text-white" : "rounded-bl-md bg-white shadow-sm"
                    } ${m.status === "held" ? "opacity-60" : ""}`}
                  >
                    {m.body}
                  </div>
                  <span className="mt-0.5 flex items-center gap-1 px-1 text-[11px] text-black/40">
                    {formatTime(m.created_at)}
                    {m.status === "held" && " · Waiting for a moderator — only you can see this"}
                    {!mine && (
                      <span className="opacity-60 group-hover:opacity-100">
                        <ReportButton targetType="message" targetId={m.id} compact />
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-4 border-t border-black/5 bg-[#f5f6f4] px-4 py-2">
        {canSend ? (
          <form onSubmit={send} className="flex gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              placeholder="Write a message…"
              className="input"
              aria-label="Message"
            />
            <button className="btn-primary px-3" disabled={sending || !text.trim()} aria-label="Send">
              <Icon name="send" />
            </button>
          </form>
        ) : (
          <p className="py-2 text-center text-sm text-black/50">{cannotSendReason}</p>
        )}
        {error && <p className="mt-1 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
