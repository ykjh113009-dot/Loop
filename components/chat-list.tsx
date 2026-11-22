"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Search, SquarePen } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { ClubIcon } from "@/components/club-icon";
import { Glyph } from "@/components/glyph";
import { makeT, type Locale } from "@/lib/i18n";

export type ChatItem = {
  id: string; href: string; title: string; preview: string; time: string; unread: boolean; request: boolean;
  kind: "direct" | "group" | "club"; avatar?: string; emoji?: string; imageUrl?: string | null;
};

// The left column of the chat screen: filters, search and every conversation. On phones it is the whole screen at /messages
// and gives way to the open chat; on computers it stays beside the chat.
export function ChatList({ items, locale }: { items: ChatItem[]; locale: Locale }) {
  const t = makeT(locale);
  const path = usePathname();
  const router = useRouter();
  // This column lives in the layout, which stays put while you move between chats; fetch it again so new chats and read marks show.
  useEffect(() => { router.refresh(); }, [path, router]);
  const [filter, setFilter] = useState<"all" | "group" | "direct">("all");
  const [q, setQ] = useState("");
  const onList = path === "/messages";
  const shown = items.filter((c) => (filter === "all" || (filter === "group" ? c.kind !== "direct" : c.kind === "direct")) && c.title.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <aside className={`${onList ? "" : "hidden lg:flex"} min-h-0 flex-col rounded-3xl border border-brand-700/10 bg-white/70 p-4 lg:flex lg:max-h-[calc(100dvh-120px)]`} data-chat-list>
      <div className="mb-3 flex items-center justify-between">
        {onList ? <h1 className="font-heading text-[28px] font-semibold text-brand-900" data-banner-title>{t("Chats")}</h1> : <p className="font-heading text-[28px] font-semibold text-brand-900">{t("Chats")}</p>}
        <Link href="/messages/new" className="rounded-xl p-2 text-brand-800 hover:bg-brand-50" aria-label={t("New group")} title={t("New group")}><SquarePen className="size-6" aria-hidden="true" /></Link>
      </div>
      <label className="relative mb-3 block">
        <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-black/40" aria-hidden="true" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Search for a chat…")} aria-label={t("Search for a chat…")} className="w-full rounded-full border border-brand-700/10 bg-[#eef2ec] py-2.5 ps-9 pe-3 text-sm outline-none focus:border-brand-700/40" />
      </label>
      <div className="mb-3 flex gap-2" role="tablist">
        {([["all", "All"], ["group", "Groups"], ["direct", "Direct Messages"]] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={filter === id} onClick={() => setFilter(id)} className={`chip ${filter === id ? "chip-on" : ""}`} data-selected={filter === id || undefined}>{t(label)}</button>
        ))}
      </div>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm text-black/50">{t("No chats yet. Join a club to use its group chat, or open a student's profile and tap Message.")}</p>
      ) : shown.length === 0 ? (
        <p className="py-8 text-center text-sm text-black/50">{t("No chats match.")}</p>
      ) : (
        <ul className="-mx-1 min-h-0 flex-1 space-y-1 overflow-y-auto px-1">
          {shown.map((c) => {
            const active = path === `/messages/${c.id}`;
            return (
              <li key={c.id}>
                <Link href={c.href} aria-current={active ? "page" : undefined} className={`flex items-center gap-3 rounded-2xl px-3 py-3 ${active ? "bg-sage-soft/70" : "hover:bg-black/[0.03]"}`}>
                  {c.kind === "direct" ? <Avatar avatar={c.avatar ?? "a01"} className="size-12" />
                    : c.kind === "club" ? <ClubIcon emoji={c.emoji ?? "⭐"} url={c.imageUrl} className="size-12 text-xl" />
                    : <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-700 text-white">
                        {c.imageUrl
                          // eslint-disable-next-line @next/next/no-img-element -- signed private image
                          ? <img src={c.imageUrl} alt="" loading="lazy" className="size-full object-cover" />
                          : <Glyph e="👥" />}
                      </span>}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-[17px] ${c.unread ? "font-bold" : "font-semibold"}`}>{c.title}</span>
                      <span className="shrink-0 text-xs text-black/45">{c.time}</span>
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className={`truncate text-sm ${c.unread ? "text-black/80" : "text-black/50"}`}>{c.request ? t("Message request") : c.preview}</span>
                      {c.unread && <span className="size-3 shrink-0 rounded-full bg-brand-700" aria-label={t("Unread")} />}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
