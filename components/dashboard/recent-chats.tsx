import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { getRecentChats } from "@/lib/dashboard";
import { timeAgo } from "@/lib/time";
import { Avatar } from "@/components/avatar";
import { CardEmpty, DashCard } from "@/components/dashboard/card";

export async function RecentChats() {
  const me = await requireMe();
  const chats = await getRecentChats(me.id, 3);
  return (
    <DashCard title="Recent Chats" href="/messages">
      {chats.length === 0 ? (
        <CardEmpty icon="chat">No chats yet. Join a club to use its group chat, or open a student&apos;s profile and tap Message.</CardEmpty>
      ) : (
        <ul className="-mx-1.5 space-y-0.5">
          {chats.map((c) => (
            <li key={c.id}>
              <Link href={c.href} className="flex items-center gap-3 rounded-xl px-1.5 py-2 hover:bg-brand-50">
                {c.avatar ? (
                  <Avatar avatar={c.avatar} size="md" />
                ) : (
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage-soft/70 text-xl">{c.emoji}</span>
                )}
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-sm ${c.unread ? "font-bold" : "font-semibold"}`}>{c.name}</span>
                  <span className="block truncate text-xs text-ink-2">{c.preview || "No messages yet"}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-ink-2">
                  {c.at && timeAgo(c.at)}
                  {c.unread && <span className="size-2 rounded-full bg-brand-700" aria-label="Unread" />}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashCard>
  );
}
