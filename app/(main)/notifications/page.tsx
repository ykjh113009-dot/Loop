import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";
import { Empty } from "@/components/empty";
import { MarkRead } from "@/components/mark-read";
import { PageHeader } from "@/components/page-header";
import { PushToggle } from "@/components/push-toggle";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Alerts" };

async function Notifications() {
  const me = await requireMe();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, title, body, link, read_at, created_at")
    .eq("recipient_id", me.id)
    .order("created_at", { ascending: false })
    .limit(60);
  const items = data ?? [];
  if (items.length === 0) return <Empty emoji="🔔" title="No alerts yet">We&apos;ll let you know about events, clubs and news.</Empty>;

  return (
    <ul className="card divide-y divide-black/5">
      <MarkRead />
      {items.map((n) => {
        const content = (
          <div className="flex gap-3 px-4 py-3">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-brand-600"}`} />
            <div className="min-w-0 flex-1">
              <p className={n.read_at ? "font-medium" : "font-bold"}>{n.title}</p>
              {n.body && <p className="text-sm text-black/60">{n.body}</p>}
            </div>
            <span className="shrink-0 text-xs text-black/40">{timeAgo(n.created_at)}</span>
          </div>
        );
        return (
          <li key={n.id}>
            {n.link ? <Link href={n.link} className="block hover:bg-black/[0.02]">{content}</Link> : content}
          </li>
        );
      })}
    </ul>
  );
}

export default function NotificationsPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="Alerts" />
      <PushToggle />
      <Suspense fallback={<PageSkeleton />}>
        <Notifications />
      </Suspense>
    </div>
  );
}
