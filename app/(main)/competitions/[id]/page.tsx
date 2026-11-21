import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { formatDate } from "@/lib/time";
import { awardCompetition, createTeam, joinTeam, leaveTeam } from "@/app/actions/community";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";
import { Glyph } from "@/components/glyph";

export const metadata = { title: "Competition" };

async function Competition({ params }: { params: PageProps<"/competitions/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const { t } = await getT();
  const { data: c } = await supabase.from("competitions").select("*").eq("id", id).maybeSingle();
  if (!c) notFound();
  const [{ data: teams }, { data: members }, { data: scores }, { data: houses }, { data: roles }, { data: myHouseId }] = await Promise.all([
    supabase.from("teams").select("id, name").eq("competition_id", id).order("created_at"),
    supabase.from("team_members").select("team_id, profile:profiles(id, full_name)").eq("competition_id", id),
    supabase.from("competition_scores").select("id, team_id, house_id, points, note, created_at").eq("competition_id", id).order("created_at", { ascending: false }),
    supabase.from("houses").select("id, name, emoji").order("sort"),
    supabase.from("leadership_roles").select("kind").eq("profile_id", me.id).eq("kind", "school_staff"),
    supabase.rpc("my_house"),
  ]);
  const myHouse = (houses ?? []).find((h) => h.id === myHouseId);
  const staff = me.isAdmin || (roles ?? []).length > 0;
  const open = new Date(c.ends_at) >= new Date();
  const byTeam = (tid: string) => (members ?? []).filter((m) => m.team_id === tid && m.profile);
  const myTeam = (members ?? []).find((m) => m.profile?.id === me.id)?.team_id;
  const total = (key: "team_id" | "house_id", v: string) => (scores ?? []).filter((s) => s[key] === v).reduce((a, s) => a + s.points, 0);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className="card p-4">
        <h1 className="text-xl font-bold"><Glyph e="🏁" /> {c.name}</h1>
        <p className="mt-1 text-xs text-black/50">{c.kind === "house" ? t("House competition") : t("Team competition (up to {n} per team)", { n: c.team_size })} · {formatDate(c.starts_at)} → {formatDate(c.ends_at)}</p>
        {c.description && <p className="mt-2 text-sm whitespace-pre-wrap text-black/75">{c.description}</p>}
      </section>

      {c.kind === "house" && (
        <section className="card space-y-2 border-brand-700/20 bg-sage-soft/30 p-4" data-house-howto>
          <h2 className="font-semibold">{t("How to take part")}</h2>
          <p className="text-sm text-black/70">{t("This is a house competition, so there is nothing to sign up for. Staff give points to houses, and every student in a house helps it climb the leaderboard.")}</p>
          {!me.isStudent ? (
            <p className="text-sm text-black/60">{t("Only students belong to a house.")}</p>
          ) : myHouse ? (
            <p className="text-sm font-medium text-brand-800">{t("Your house: {name}. Earn points and join events to help it win.", { name: myHouse.name })}</p>
          ) : (
            <p className="text-sm text-black/70">{t("You are not in a house yet. Houses are made from classes, so ask an admin to add your class to a house.")}</p>
          )}
          {me.isAdmin && <Link href="/admin/houses" className="text-sm text-brand-700 underline">{t("Set up houses and their classes")}</Link>}
        </section>
      )}

      {c.kind === "team" && (
        <section className="space-y-2">
          <h2 className="section-title">{t("Teams")}</h2>
          {(teams ?? []).length === 0 && <p className="text-sm text-black/55">{t("No teams yet.")}</p>}
          {(teams ?? []).map((tm) => {
            const list = byTeam(tm.id);
            return (
              <article key={tm.id} className="card p-4" data-team={tm.name}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">{tm.name} <span className="font-normal text-black/50">· {total("team_id", tm.id)} {t("points")}</span></p>
                  {me.isStudent && open && (myTeam === tm.id ? (
                    <ActionForm action={leaveTeam}><input type="hidden" name="teamId" value={tm.id} /><SubmitButton className="btn-ghost px-2.5 py-1 text-xs" pendingText="…">{t("Leave")}</SubmitButton></ActionForm>
                  ) : !myTeam && list.length < c.team_size ? (
                    <ActionForm action={joinTeam}><input type="hidden" name="teamId" value={tm.id} /><SubmitButton className="btn-secondary px-2.5 py-1 text-xs" pendingText="…">{t("Join")}</SubmitButton></ActionForm>
                  ) : null)}
                </div>
                <p className="mt-1 text-sm text-black/60">{list.map((m) => m.profile!.full_name).join(", ")}</p>
                {staff && (
                  <ActionForm action={awardCompetition} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="competitionId" value={c.id} /><input type="hidden" name="teamId" value={tm.id} />
                    <input name="points" type="number" min={1} max={500} required placeholder={t("Points")} aria-label={t("Points")} className="input w-24 py-1.5 text-sm" />
                    <input name="note" maxLength={200} placeholder={t("Why?")} aria-label={t("Why?")} className="input min-w-32 flex-1 py-1.5 text-sm" />
                    <SubmitButton className="btn-primary px-3 py-1.5 text-sm" pendingText="…">{t("Give points")}</SubmitButton>
                  </ActionForm>
                )}
              </article>
            );
          })}
          {me.isStudent && open && !myTeam && !me.isSuspended && (
            <ActionForm action={createTeam} className="card flex flex-wrap gap-2 p-4">
              <input type="hidden" name="competitionId" value={c.id} />
              <input name="name" required minLength={2} maxLength={40} placeholder={t("Name your team")} aria-label={t("Name your team")} className="input min-w-40 flex-1" />
              <SubmitButton className="btn-primary" pendingText="…">{t("Create team")}</SubmitButton>
            </ActionForm>
          )}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="section-title">{t("House points from this competition")}</h2>
        <ul className="card divide-y divide-black/5 text-sm">
          {(houses ?? []).map((h) => (
            <li key={h.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
              <span className="min-w-0 flex-1"><Glyph e={h.emoji} /> {h.name}</span>
              <strong className="tabular-nums">{total("house_id", h.id)}</strong>
              {staff && (
                <ActionForm action={awardCompetition} className="flex gap-1.5">
                  <input type="hidden" name="competitionId" value={c.id} /><input type="hidden" name="houseId" value={h.id} />
                  <input name="points" type="number" min={1} max={500} required placeholder="+" aria-label={`${t("Points")} ${h.name}`} className="input w-20 py-1 text-sm" />
                  <SubmitButton className="btn-secondary px-2.5 py-1 text-xs" pendingText="…">{t("Give")}</SubmitButton>
                </ActionForm>
              )}
            </li>
          ))}
          {(houses ?? []).length === 0 && <li className="px-4 py-3 text-black/55">{t("Houses have not been set up yet.")}</li>}
        </ul>
        <p className="text-xs text-black/50"><Link href="/leaderboard" className="underline">{t("See the leaderboards")}</Link></p>
      </section>
    </div>
  );
}

export default function CompetitionPage(props: PageProps<"/competitions/[id]">) {
  return (
    <>
      <PageHeader title="Competition" back="/competitions" />
      <Suspense fallback={<PageSkeleton />}>
        <Competition params={props.params} />
      </Suspense>
    </>
  );
}
