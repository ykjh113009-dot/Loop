import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { CardEmpty, DashCard } from "@/components/dashboard/card";

// Your newest achievements. Only real, earned badges; students only.
export async function Achievements() {
  const me = await requireMe();
  if (!me.isStudent) return null;
  const { t } = await getT();
  const supabase = await createClient();
  const { data } = await supabase.from("profile_badges").select("earned_at, badge:badges(code, name, emoji, tier)").eq("profile_id", me.id).order("earned_at", { ascending: false }).limit(6);
  const rows = (data ?? []).filter((r) => r.badge);
  return (
    <DashCard title={t("Your achievements")} href="/points" linkLabel={t("See all")}>
      {rows.length === 0 ? (
        <CardEmpty icon="star">{t("Your first achievement is one step away. Sign in, join a club or save a resource.")}</CardEmpty>
      ) : (
        <ul className="flex flex-wrap gap-2" data-card="achievements">
          {rows.map((r) => (
            <li key={r.badge!.code}><Link href="/points" className="chip bg-white shadow-sm" title={r.badge!.name}>{r.badge!.emoji} {t(r.badge!.name)}</Link></li>
          ))}
        </ul>
      )}
    </DashCard>
  );
}
