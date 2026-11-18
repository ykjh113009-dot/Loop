import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { houseColor } from "@/lib/house";
import { LeaderTabs, type LeaderRow } from "@/components/home/leader-tabs";

export async function HomeLeaderboard() {
  const me = await requireMe();
  const { t } = await getT();
  const supabase = await createClient();
  const [{ data: houses }, { data: students }, { data: grades }, { data: myHouse }] = await Promise.all([
    supabase.rpc("house_leaderboard", { p_period: "week" }),
    supabase.rpc("individual_leaderboard", { p_period: "week", p_grade: null as unknown as number, p_limit: 3 }),
    supabase.rpc("grade_leaderboard", { p_period: "week" }),
    supabase.rpc("my_house"),
  ]);
  const h: LeaderRow[] = (houses ?? []).slice(0, 3).map((x) => ({ id: x.house_id, name: x.name, value: Number(x.points), color: houseColor(x.color), badge: x.emoji, me: x.house_id === myHouse }));
  const s: LeaderRow[] = (students ?? []).slice(0, 3).map((x) => ({ id: x.profile_id, name: x.full_name, value: Number(x.points), badge: "🎓", me: x.profile_id === me.id }));
  const g: LeaderRow[] = (grades ?? []).slice(0, 3).map((x) => ({ id: String(x.grade), name: `${t("Grade")} ${x.grade}`, value: Math.round(Number(x.avg_points)), badge: String(x.grade), me: x.grade === me.grade }));
  return <LeaderTabs labels={{ title: t("Leaderboard"), all: t("See all"), empty: t("No points yet this week.") }} tabs={[
    { key: "houses", label: t("Houses"), rows: h, unit: t("Points this week") },
    { key: "students", label: t("Students"), rows: s, unit: t("Points this week") },
    { key: "grades", label: t("Grades"), rows: g, unit: t("Average points per student this week") },
  ]} />;
}
