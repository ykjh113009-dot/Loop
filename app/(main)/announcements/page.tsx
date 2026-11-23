import { Suspense } from "react";
import { AdminControls } from "@/components/admin-controls";
import { contentPowers } from "@/lib/content-powers";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { iconFor } from "@/lib/dashboard";
import { formatDateTime } from "@/lib/time";
import { Empty } from "@/components/empty";
import { ImageBanner } from "@/components/ui/image-banner";
import { PageSkeleton } from "@/components/skeleton";
import { IconTile } from "@/components/dashboard/card";

export const metadata = { title: "Announcements" };

async function Announcements() {
  const me = await requireMe();
  const supabase = await createClient();
  const { data } = await supabase.from("announcements").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(50);
  if (!data || data.length === 0) return <Empty emoji="📣" title="No announcements yet">School news will show up here.</Empty>;
  return (
    <ul className="space-y-3">
      {data.map((a) => {
        const icon = iconFor(`${a.title} ${a.body}`);
        return (
          <li key={a.id} className="card flex gap-3 p-4">
            <IconTile name={icon === "calendar" ? "megaphone" : icon} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-semibold">{a.title}</h2>
                {me.isStaff && <AdminControls kind="announcement" id={a.id} title={a.title} detail={a.body} {...contentPowers(me, "announcement")} next="/announcements" compact />}
              </div>
              <p className="text-xs text-ink-2">{formatDateTime(a.created_at)}</p>
              <p className="mt-2 text-sm break-words whitespace-pre-wrap">{a.body}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default function AnnouncementsPage() {
  return (
    <div className="space-y-4">
      <ImageBanner name="announcements" title="Announcements" subtitle="Stay updated." />
      <Suspense fallback={<PageSkeleton />}>
        <Announcements />
      </Suspense>
    </div>
  );
}
