import { Suspense } from "react";
import Link from "next/link";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/time";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { BottomNav, type Badges } from "@/components/bottom-nav";

const NO_BADGES: Badges = { notifications: 0, messages: 0, moderation: 0 };

async function HeaderActions() {
  const me = await getMe();
  if (!me) return null;
  return (
    <div className="flex items-center gap-1">
      <Link href="/more" className="rounded-full p-2 text-black/60 hover:bg-black/5" aria-label="More features">
        <Icon name="grid" />
      </Link>
      {me.isCounselor && (
        <Link href="/counselor" className="rounded-full p-2 text-black/60 hover:bg-black/5" aria-label="Counselor inbox">
          <Icon name="lock" />
        </Link>
      )}
      <Link href="/people" className="rounded-full p-2 text-black/60 hover:bg-black/5" aria-label="Find students">
        <Icon name="search" />
      </Link>
      {me.isStaff && (
        <Link href="/moderation" className="rounded-full p-2 text-black/60 hover:bg-black/5" aria-label="Moderation">
          <Icon name="shield" />
        </Link>
      )}
      {me.isAdmin && (
        <Link href="/admin" className="rounded-full p-2 text-black/60 hover:bg-black/5" aria-label="Admin dashboard">
          <Icon name="chart" />
        </Link>
      )}
      <Link href={`/profile/${me.id}`} className="ml-1" aria-label="My profile">
        <Avatar avatar={me.avatar} size="sm" />
      </Link>
    </div>
  );
}

async function SuspendedBanner() {
  const me = await getMe();
  if (!me?.isSuspended || !me.suspended_until) return null;
  const permanent = new Date(me.suspended_until).getFullYear() > 9000;
  return (
    <div className="mx-4 mt-3 rounded-xl bg-red-50 print:hidden px-4 py-3 text-sm text-red-800">
      <p className="font-semibold">Your account is suspended {permanent ? "until further notice" : `until ${formatDateTime(me.suspended_until)}`}.</p>
      <p>You can still look around, but you can&apos;t post, chat or RSVP. Reason: {me.suspension_reason}</p>
    </div>
  );
}

async function Nav() {
  const me = await getMe();
  if (!me) return <BottomNav userId={null} initial={NO_BADGES} />;
  const supabase = await createClient();
  const { data } = await supabase.rpc("my_badges");
  return <BottomNav userId={me.id} initial={(data as Badges | null) ?? NO_BADGES} />;
}

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-2xl pb-24">
      <header className="sticky top-0 z-20 print:hidden flex items-center justify-between border-b border-black/5 bg-[#f5f6f4]/90 px-4 py-2 backdrop-blur">
        <Link href="/home" className="flex items-center" aria-label="Loop home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/loop-wordmark.png" alt="Loop" width={67} height={28} className="h-7 w-auto" />
        </Link>
        <Suspense fallback={<div className="size-8" />}>
          <HeaderActions />
        </Suspense>
      </header>
      <Suspense>
        <SuspendedBanner />
      </Suspense>
      <main className="px-4 py-4">{children}</main>
      <Suspense fallback={<div className="fixed inset-x-0 bottom-0 h-16 border-t border-black/5 bg-white/95 print:hidden" />}>
        <Nav />
      </Suspense>
    </div>
  );
}
