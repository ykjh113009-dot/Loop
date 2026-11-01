import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { getMyClubs } from "@/lib/dashboard";
import { LineIcon } from "@/components/line-icon";
import { CardEmpty, DashCard } from "@/components/dashboard/card";

export async function QuickChats() {
  const me = await requireMe();
  const clubs = (await getMyClubs(me.id)).slice(0, 4);
  return (
    <DashCard title="Quick Chats" href="/messages">
      {clubs.length === 0 ? (
        <CardEmpty icon="community">
          Join a club to get its group chat.
          <Link href="/clubs" className="mt-2 block font-semibold text-brand-700 hover:underline">Find a club</Link>
        </CardEmpty>
      ) : (
        <ul className="-mx-1.5 space-y-0.5">
          {clubs.map((c) => (
            <li key={c.id}>
              <Link href={`/clubs/${c.id}/chat`} className="flex items-center gap-3 rounded-xl px-1.5 py-2 hover:bg-brand-50">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sage-soft/70 text-xl">{c.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{c.name}</span>
                  <span className="block text-xs text-ink-2">{c.members} {c.members === 1 ? "member" : "members"}</span>
                </span>
                <LineIcon name="chevronRight" className="size-4 text-ink-2" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashCard>
  );
}
