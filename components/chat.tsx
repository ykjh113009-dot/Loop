"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { connectRealtime, createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { ReportButton } from "@/components/report-button";
import { formatDate, formatTime, localDayKey } from "@/lib/time";
import type { ChatMessage, ChatPerson, ChatReaction } from "@/lib/chat";
import { makeT, type Locale } from "@/lib/i18n";
import { CheckCheck, Mic, Paperclip, SmilePlus, Square } from "lucide-react";

const FIELDS = "id, sender_id, body, status, created_at, attachment_path, attachment_kind, attachment_name";
const EMOJI = ["👍", "❤️", "😂", "😮", "😢", "👏"];
const MAX_FILE = 10 * 1024 * 1024;

// A photo, voice message, video or file inside a message. Files are private,
// so the link is created for the signed-in member when the message is shown.
function Attachment({ message, label }: { message: ChatMessage; label: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    createClient().storage.from("chat-files").createSignedUrl(message.attachment_path!, 3600).then(({ data }) => live && setUrl(data?.signedUrl ?? null));
    return () => { live = false; };
  }, [message.attachment_path]);
  if (!url) return <span className="text-xs opacity-70">…</span>;
  if (message.attachment_kind === "image") {
    // eslint-disable-next-line @next/next/no-img-element -- private signed link
    return <a href={url} target="_blank" rel="noreferrer"><img src={url} alt={label} className="max-h-64 rounded-xl" /></a>;
  }
  if (message.attachment_kind === "audio") return <audio controls src={url} className="max-w-full" aria-label={label} />;
  if (message.attachment_kind === "video") return <video controls src={url} className="max-h-64 rounded-xl" aria-label={label} />;
  return <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline"><Paperclip className="size-4" aria-hidden="true" /> {message.attachment_name ?? label}</a>;
}

export function Chat({
  conversationId,
  meId,
  schoolId,
  initialMessages,
  initialPeople,
  canSend,
  cannotSendReason,
  showNames,
  initialReactions = [],
  locale = "en",
  requestPending = false,
}: {
  conversationId: string;
  meId: string;
  schoolId: string;
  initialMessages: ChatMessage[];
  initialPeople: Record<string, ChatPerson>;
  canSend: boolean;
  cannotSendReason?: string;
  showNames: boolean;
  initialReactions?: ChatReaction[];
  locale?: Locale;
  /** The other person has not accepted this chat yet: one message, then wait. */
  requestPending?: boolean;
}) {
  const [locked, setLocked] = useState(false);
  const t = makeT(locale);
  const [reactions, setReactions] = useState(initialReactions);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
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
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "message_reactions", filter: `conversation_id=eq.${conversationId}` },
          () => {
            supabase.from("message_reactions").select("message_id, profile_id, emoji").eq("conversation_id", conversationId).limit(2000)
              .then(({ data }) => data && setReactions(data));
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

  async function post(body: string, attachment?: { path: string; kind: string; name: string }) {
    setSending(true);
    setError(null);
    const { data, error } = await createClient()
      .from("messages")
      .insert({
        conversation_id: conversationId, sender_id: meId, body, school_id: schoolId,
        ...(attachment ? { attachment_path: attachment.path, attachment_kind: attachment.kind, attachment_name: attachment.name } : {}),
      })
      .select(FIELDS)
      .single();
    setSending(false);
    if (error) {
      setError(/RATE_LIMIT|RESTRICTED|request/i.test(error.message) ? error.message.replace(/^[A-Z_]+: /, "") : t("Your message wasn't sent. Please try again."));
      return false;
    }
    add(data as ChatMessage);
    if (requestPending) setLocked(true);
    return true;
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    if (await post(body)) setText("");
  }

  async function sendFile(file: Blob, name: string) {
    if (file.size > MAX_FILE) return setError(t("That file is too big (10 MB at most)."));
    const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("audio/") ? "audio" : file.type.startsWith("video/") ? "video" : "file";
    const ext = (name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
    const path = `${conversationId}/${meId}/${crypto.randomUUID()}.${ext}`;
    setSending(true);
    setError(null);
    const { error } = await createClient().storage.from("chat-files").upload(path, file, { contentType: file.type.split(";")[0] });
    if (error) {
      setSending(false);
      return setError(t("That file could not be sent. Photos, PDFs, documents, short videos and voice messages work."));
    }
    await post("", { path, kind, name: name.slice(0, 120) });
  }

  async function toggleRecording() {
    if (recording) {
      recorder.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        setRecording(false);
        const blob = new Blob(chunks, { type: (rec.mimeType || "audio/webm").split(";")[0] });
        if (blob.size > 0) sendFile(blob, blob.type.includes("mp4") ? "voice.m4a" : "voice.webm");
      };
      recorder.current = rec;
      rec.start();
      setRecording(true);
      setTimeout(() => rec.state === "recording" && rec.stop(), 120000);
    } catch {
      setError(t("Loop could not use the microphone. Allow it in your browser and try again."));
    }
  }

  async function react(messageId: string, emoji: string) {
    const mine = reactions.find((r) => r.message_id === messageId && r.profile_id === meId);
    const supabase = createClient();
    const rest = reactions.filter((r) => !(r.message_id === messageId && r.profile_id === meId));
    if (mine?.emoji === emoji) {
      setReactions(rest);
      await supabase.from("message_reactions").delete().eq("message_id", messageId).eq("profile_id", meId);
    } else {
      setReactions([...rest, { message_id: messageId, profile_id: meId, emoji }]);
      if (mine) await supabase.from("message_reactions").update({ emoji }).eq("message_id", messageId).eq("profile_id", meId);
      else await supabase.from("message_reactions").insert({ message_id: messageId, profile_id: meId, conversation_id: conversationId, emoji });
    }
  }

  return (
    <div className="relative isolate flex min-h-[60dvh] flex-col overflow-hidden rounded-3xl bg-[#e7eee1] px-3 pt-3 lg:px-6 lg:pt-5" data-chat-panel>
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <span className="absolute -end-16 -top-10 size-72 rounded-[45%] bg-[#d5e2cb]/70" />
        <span className="absolute -start-20 top-1/3 size-80 rounded-[45%] bg-[#dbe7d2]/70" />
        <span className="absolute -end-10 bottom-10 size-72 rounded-[45%] bg-[#d3e0c8]/60" />
      </div>
      <div className="flex-1 space-y-1 pb-4">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-black/45">{t("No messages yet. Say hi! 👋")}</p>}
        {messages.map((m, i) => {
          const mine = m.sender_id === meId;
          const person = people[m.sender_id];
          const prev = messages[i - 1];
          const newDay = !prev || localDayKey(prev.created_at) !== localDayKey(m.created_at);
          const sameSender = !newDay && prev?.sender_id === m.sender_id;
          return (
            <div key={m.id}>
              {newDay && <p className="py-3 text-center"><span className="inline-block rounded-full bg-black/[0.06] px-4 py-1 text-sm font-medium text-black/60">{formatDate(m.created_at)}</span></p>}
              <div className={`group flex items-start gap-2 ${mine ? "flex-row-reverse" : ""} ${sameSender ? "" : "pt-2"}`}>
                {!mine && (
                  <Link href={`/profile/${m.sender_id}`} className={sameSender ? "invisible" : ""}>
                    <Avatar avatar={person?.avatar ?? "a01"} className="size-11" />
                  </Link>
                )}
                <div className={`max-w-[78%] ${mine ? "items-end" : "items-start"} flex flex-col`}>
                  {showNames && !mine && !sameSender && (
                    <span className="mb-0.5 px-1 text-sm font-semibold text-brand-800">{person?.full_name ?? "…"}</span>
                  )}
                  <div
                    className={`rounded-2xl px-4 py-2.5 text-[17px] break-words whitespace-pre-wrap ${
                      mine ? "rounded-ee-md bg-[#d9e8cf] text-brand-900" : "rounded-es-md bg-white shadow-sm"
                    } ${m.status === "held" ? "opacity-60" : ""}`}
                  >
                    {m.attachment_path && <Attachment message={m} label={t("Attachment")} />}
                    {m.body}
                    <span className="ms-3 inline-flex translate-y-0.5 items-center gap-1 align-bottom text-[11px] text-black/45">
                      {formatTime(m.created_at)}
                      {mine && <CheckCheck className="size-3.5 text-brand-700" aria-hidden="true" />}
                    </span>
                  </div>
                  {(() => {
                    const mineR = reactions.filter((r) => r.message_id === m.id);
                    const counts = EMOJI.map((e) => [e, mineR.filter((r) => r.emoji === e).length] as const).filter(([, n]) => n > 0);
                    return (
                      <span className="mt-0.5 flex flex-wrap items-center gap-1 px-1">
                        {counts.map(([e, n]) => (
                          <button key={e} type="button" onClick={() => canSend && react(m.id, e)} className="rounded-full bg-white px-1.5 text-xs shadow-sm" aria-label={`${e} ${n}`}>
                            {e} {n}
                          </button>
                        ))}
                        {canSend && m.status === "visible" && (
                          <details className="relative">
                            <summary className="cursor-pointer list-none rounded-full px-1 text-xs text-black/40 opacity-60 group-hover:opacity-100 [&::-webkit-details-marker]:hidden" aria-label={t("React")}><SmilePlus className="size-4" aria-hidden="true" /></summary>
                            <span className="absolute bottom-6 z-10 flex gap-0.5 rounded-full border border-black/10 bg-white p-1 shadow-lg">
                              {EMOJI.map((e) => (
                                <button key={e} type="button" onClick={(ev) => { react(m.id, e); (ev.currentTarget.closest("details") as HTMLDetailsElement).open = false; }} className="rounded-full px-1 text-lg hover:bg-black/5">{e}</button>
                              ))}
                            </span>
                          </details>
                        )}
                      </span>
                    );
                  })()}
                  <span className="mt-0.5 flex items-center gap-1 px-1 text-[11px] text-black/40">
                    {m.status === "held" && t("Waiting for a moderator. Only you can see this.")}
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

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] -mx-3 bg-transparent px-3 py-2 lg:bottom-3 lg:mx-0 lg:px-0">
        {locked ? (
          <p className="py-2 text-center text-sm text-black/50">{t("Your message request was sent. You can write again once it is accepted.")}</p>
        ) : canSend ? (
          <form onSubmit={send} className="flex items-center gap-2 rounded-full border border-brand-700/10 bg-white py-1.5 ps-3 pe-1.5 shadow-sm">
            <input ref={fileInput} type="file" hidden accept="image/*,video/mp4,video/webm,audio/*,application/pdf,.docx,.pptx,.xlsx,.txt"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) sendFile(f, f.name); e.target.value = ""; }} />
            <button type="button" onClick={() => fileInput.current?.click()} disabled={sending} className="rounded-full p-2 text-black/55 hover:bg-black/5" aria-label={t("Send a photo or file")}><Paperclip className="size-5" aria-hidden="true" /></button>
            <button type="button" onClick={toggleRecording} disabled={sending} className={`rounded-full p-2 ${recording ? "btn-danger" : "text-black/55 hover:bg-black/5"}`} aria-label={recording ? t("Stop and send the voice message") : t("Record a voice message")}>{recording ? <Square className="size-5" aria-hidden="true" /> : <Mic className="size-5" aria-hidden="true" />}</button>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={2000}
              placeholder={t("Write a message…")}
              className="min-w-0 flex-1 bg-transparent py-2 text-base outline-none"
              aria-label={t("Message")}
            />
            <button className="btn-primary size-11 shrink-0 !rounded-full !p-0" disabled={sending || !text.trim()} aria-label={t("Send")}>
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
