import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { leadershipLabel } from "@/lib/leadership";
import { formatDate } from "@/lib/time";
import { postClassAnnouncement } from "@/app/actions/community";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Leadership dashboard" };

function Tool({ href, icon, title, text, count }: { href: string; icon: string; title: string; text: string; count?: number }) {
  return (
    <Link href={href} className="card flex items-center gap-3 p-4 hover:bg-black/[0.02]">
      <span className="text-2xl">{icon}</span>
      <span className="min-w-0 flex-1"><span className="block font-semibold">{title}</span><span className="block text-sm text-black/55">{text}</span></span>
      {count ? <span className="rounded-full bg-red-600 px-2 text-xs leading-5 font-bold text-white">{count}</span> : null}
    </Link>
  );
}

// One dashboard for every leadership role. It only shows the tools the signed-in
// student is allowed to use; the database checks the same thing again.
async function Dashboard() {
  const me = await requireMe();
  const supabase = await createClient();
  const { t } = await getT();
  const { data: roles } = await supabase.from("leadership_roles").select("id, kind, scope, club:clubs(id, name, emoji)").eq("profile_id", me.id);
  const list = roles ?? [];
  const has = (k: string) => list.some((r) => r.kind === k);
  const classes = list.filter((r) => r.kind === "class_rep");
  const clubs = list.filter((r) => r.kind === "club_leader" && r.club);
  const staff = has("school_staff");

  const [classData, clubData, claims, redemptions, achievements, suggestions] = await Promise.all([
    Promise.all(classes.map(async (r) => {
      const [{ data: summary }, { data: posts }] = await Promise.all([
        supabase.rpc("class_summary", { p_class: r.scope }),
        supabase.from("class_announcements").select("id, title, body, created_at").eq("grade", Number(r.scope.replace(/\D/g, ""))).eq("section", r.scope.slice(-1)).order("created_at", { ascending: false }).limit(3),
      ]);
      return { r, summary: summary as unknown as { students: number; points_week: number; house: string | null }, posts: posts ?? [] };
    })),
    Promise.all(clubs.map(async (r) => {
      const [{ count: apps }, { count: members }] = await Promise.all([
        supabase.from("club_applications").select("id", { count: "exact", head: true }).eq("club_id", r.club!.id).eq("status", "pending"),
        supabase.from("club_members").select("profile_id", { count: "exact", head: true }).eq("club_id", r.club!.id),
      ]);
      return { r, apps: apps ?? 0, members: members ?? 0 };
    })),
    staff ? supabase.from("point_claims").select("id", { count: "exact", head: true }).eq("status", "pending") : Promise.resolve({ count: 0 }),
    staff ? supabase.from("reward_redemptions").select("id", { count: "exact", head: true }).eq("status", "pending") : Promise.resolve({ count: 0 }),
    staff ? supabase.from("club_achievements").select("id", { count: "exact", head: true }).eq("status", "pending") : Promise.resolve({ count: 0 }),
    has("council_member") ? supabase.from("suggestions").select("id", { count: "exact", head: true }).eq("status", "new") : Promise.resolve({ count: 0 }),
  ]);

  if (list.length === 0 && !me.isAdmin) {
    return (
      <div className="card space-y-2 p-5 text-center">
        <p className="text-3xl">🎖️</p>
        <h2 className="font-semibold">{t("You do not have a leadership role yet")}</h2>
        <p className="text-sm text-black/60">{t("Class representatives, club leaders, council members and school staff get their tools here. You can ask for a role.")}</p>
        <Link href="/leadership" className="btn-primary">{t("Ask for a role")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <section className="flex flex-wrap gap-2">
        {list.map((r) => <span key={r.id} className="chip bg-brand-50 text-brand-800">{leadershipLabel(r.kind, r.scope, r.club?.name)}</span>)}
        {me.isAdmin && <span className="chip bg-brand-50 text-brand-800">{me.role === "super_admin" ? "Super Admin" : "Admin"}</span>}
      </section>

      {classData.map(({ r, summary, posts }) => (
        <section key={r.id} className="space-y-3" data-tools="class_rep">
          <h2 className="section-title">{t("Class {c}", { c: r.scope })}</h2>
          <div className="grid grid-cols-3 gap-2">
            <div className="card p-3"><p className="text-xs text-black/50">{t("Students")}</p><p className="text-xl font-bold tabular-nums">{summary.students}</p></div>
            <div className="card p-3"><p className="text-xs text-black/50">{t("Points this week")}</p><p className="text-xl font-bold tabular-nums">{summary.points_week}</p></div>
            <div className="card p-3"><p className="text-xs text-black/50">{t("House")}</p><p className="text-xl font-bold">{summary.house ?? "-"}</p></div>
          </div>
          <ActionForm action={postClassAnnouncement} className="card space-y-2 p-4">
            <input type="hidden" name="class" value={r.scope} />
            <h3 className="font-semibold">{t("Announce something to your class")}</h3>
            <input name="title" required minLength={2} maxLength={100} placeholder={t("Title")} aria-label={t("Title")} className="input" />
            <textarea name="body" required minLength={2} maxLength={1000} rows={3} placeholder={t("What does your class need to know?")} aria-label={t("What does your class need to know?")} className="input resize-none" />
            <SubmitButton className="btn-primary w-full">{t("Send to the class")}</SubmitButton>
          </ActionForm>
          {posts.length > 0 && (
            <ul className="card divide-y divide-black/5 text-sm">
              {posts.map((p) => <li key={p.id} className="px-4 py-2"><p className="font-medium">{p.title}</p><p className="text-black/60">{p.body}</p><p className="text-xs text-black/40">{formatDate(p.created_at)}</p></li>)}
            </ul>
          )}
        </section>
      ))}

      {clubData.length > 0 && (
        <section className="space-y-2" data-tools="club_leader">
          <h2 className="section-title">{t("Your clubs")}</h2>
          {clubData.map(({ r, apps, members }) => (
            <Tool key={r.id} href={`/clubs/${r.club!.id}/manage`} icon={r.club!.emoji} title={r.club!.name} text={`${members} ${t("members")} · ${t("applications, meetings, tasks, budget and more")}`} count={apps} />
          ))}
        </section>
      )}

      {has("council_member") && (
        <section className="space-y-2" data-tools="council_member">
          <h2 className="section-title">{t("Student council")}</h2>
          <Tool href="/suggestions" icon="💡" title={t("Suggestion box")} text={t("Read and answer what students suggest")} count={suggestions.count ?? 0} />
          <Tool href="/groups/new" icon="📣" title={t("Make an official group")} text={t("For a topic, an event or a team the council runs")} />
          <Tool href="/council" icon="🗳️" title={t("Council page")} text={t("Members and elections")} />
        </section>
      )}

      {(staff || me.isAdmin) && (
        <section className="space-y-2" data-tools="school_staff">
          <h2 className="section-title">{t("School administration")}</h2>
          <Tool href="/admin/points" icon="⭐" title={t("Points requests and rules")} text={t("Check what students ask for and club achievements")} count={(claims.count ?? 0) + (achievements.count ?? 0)} />
          <Tool href="/admin/rewards" icon="🎁" title={t("Rewards shop")} text={t("Hand over prizes and add new ones")} count={redemptions.count ?? 0} />
          <Tool href="/admin/houses" icon="🏠" title={t("Houses and competitions")} text={t("Create competitions and give points to teams and houses")} />
          <Tool href="/groups/new" icon="📣" title={t("Make an official group")} text={t("For classes, activities and announcements")} />
          {me.isAdmin && <Tool href="/admin" icon="⚙️" title={t("Admin dashboard")} text={t("Accounts, moderation and settings")} />}
        </section>
      )}

      <p className="text-center text-sm"><Link href="/leadership" className="font-semibold text-brand-700 hover:underline">{t("Your roles and requests")}</Link></p>
    </div>
  );
}

export default function LeadershipDashboardPage() {
  return (
    <>
      <PageHeader title="Leadership dashboard" back="/leadership" />
      <Suspense fallback={<PageSkeleton />}>
        <Dashboard />
      </Suspense>
    </>
  );
}
