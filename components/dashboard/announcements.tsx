import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { iconFor } from "@/lib/dashboard";
import { timeAgo } from "@/lib/time";
import { CardEmpty, DashCard, IconTile } from "@/components/dashboard/card";

export async function Announcements() {
  await requireMe();
  const supabase = await createClient();
  const { data } = await supabase.from("announcements").select("id, title, body, created_at").order("created_at", { ascending: false }).limit(3);
  return (
    <DashCard title="School Announcements" href="/announcements">
      {!data || data.length === 0 ? (
        <CardEmpty icon="megaphone">No announcements yet. School news will show up here.</CardEmpty>
      ) : (
        <ul className="-mx-1.5 space-y-0.5">
          {data.map((a) => {
            const icon = iconFor(`${a.title} ${a.body}`);
            return (
              <li key={a.id}>
                <Link href="/announcements" className="flex items-start gap-3 rounded-xl px-1.5 py-2 hover:bg-brand-50">
                  <IconTile name={icon === "calendar" ? "megaphone" : icon} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{a.title}</span>
                    <span className="block truncate text-xs text-ink-2">
                      {a.body.replace(/\s+/g, " ").slice(0, 60)} · {timeAgo(a.created_at)}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashCard>
  );
}
