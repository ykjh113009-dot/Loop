import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { signImages } from "@/lib/images";
import { categoryOf, kindOf, PROOF } from "@/lib/challenges";
import { formatDateTime, timeAgo } from "@/lib/time";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { IdeaDecision } from "../forms";
import { Glyph } from "@/components/glyph";

export const metadata = { title: "Review challenges" };

const ACTIONS: Record<string, string> = {
  submit: "sent", withdraw: "took back", approve: "approved", reject: "rejected", override_approve: "changed to approved",
  override_reject: "changed to rejected", cancel: "cancelled", claim: "started checking", rank: "chose the winners",
};
const FLAGS: Record<string, string> = {
  rejections: "Many rejected entries", burst: "Very many entries in a day", creator_favours: "Entries approved by the same creator again and again", ideas_rejected: "Challenge ideas keep getting rejected",
};

async function Review({ searchParams }: { searchParams: PageProps<"/challenges/review">["searchParams"] }) {
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data: govern } = await supabase.rpc("can_govern_challenges");
  if (!govern && !me.isStaff) redirect("/challenges");
  const { tab: raw } = await searchParams;
  const tab = raw === "entries" || raw === "activity" || raw === "flags" ? raw : "ideas";

  const [{ data: ideas }, { data: waiting }, { data: activity }, { data: flags }] = await Promise.all([
    supabase.from("challenges").select("id, title, emoji, description, instructions, rules, category, kind, points, reward_mode, starts_at, ends_at, proof_kinds, audience, audience_grade, audience_section, max_participants, cover_path, submitted_at, creator:profiles!challenges_created_by_fkey(full_name, grade)").eq("status", "pending").order("submitted_at"),
    supabase.from("challenge_submissions").select("id, status, created_at, challenge:challenges(id, title, emoji), student:profiles!challenge_submissions_profile_id_fkey(full_name, grade)").in("status", ["submitted", "pending"]).order("created_at").limit(100),
    tab === "activity" ? supabase.from("challenge_reviews").select("id, action, subject, note, created_at, challenge:challenges(id, title), actor:profiles!challenge_reviews_actor_id_fkey(full_name)").order("created_at", { ascending: false }).limit(60) : Promise.resolve({ data: [] }),
    tab === "flags" ? supabase.rpc("challenge_flags") : Promise.resolve({ data: [] }),
  ]);
  const ideaIds = (ideas ?? []).map((i) => i.id);
  const [{ data: prizes }, covers] = await Promise.all([
    ideaIds.length ? supabase.from("challenge_prizes").select("challenge_id, place, points").in("challenge_id", ideaIds).order("place") : Promise.resolve({ data: [] }),
    signImages(supabase, (ideas ?? []).map((i) => i.cover_path)),
  ]);
  const tabs = [["ideas", `${t("Ideas")} (${(ideas ?? []).length})`], ["entries", `${t("Entries")} (${(waiting ?? []).length})`], ["activity", t("Activity")], ["flags", t("Warning signs")]] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-black/5 p-1" role="tablist">
        {tabs.map(([id, label]) => (
          <Link key={id} role="tab" aria-selected={tab === id} href={`/challenges/review?tab=${id}`} className={`flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium whitespace-nowrap ${tab === id ? "bg-brand-700 text-white shadow-sm" : "text-black/55 hover:bg-sage-soft/60"}`}>{label}</Link>
        ))}
      </div>

      {tab === "ideas" && ((ideas ?? []).length === 0 ? <p className="card p-4 text-sm text-black/55">{t("No challenge ideas are waiting.")}</p> : (ideas ?? []).map((c) => (
        <article key={c.id} className="card space-y-3 p-4 text-sm">
          {c.cover_path && covers.get(c.cover_path) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={covers.get(c.cover_path)!} alt="" className="h-32 w-full rounded-xl object-cover" />
          )}
          <div>
            <h2 className="text-base font-bold"><Glyph e={c.emoji} /> {c.title}</h2>
            <p className="text-xs text-black/50">{t("by {name}", { name: c.creator?.full_name ?? "?" })} · <Glyph e={categoryOf(c.category).emoji} /> {t(categoryOf(c.category).label)} · {t(kindOf(c.kind).label)}</p>
          </div>
          <p className="whitespace-pre-wrap text-black/75">{c.description}</p>
          {c.instructions && <p className="whitespace-pre-wrap text-black/65"><strong>{t("What to do")}:</strong> {c.instructions}</p>}
          {c.rules && <p className="whitespace-pre-wrap text-black/65"><strong>{t("Rules")}:</strong> {c.rules}</p>}
          <ul className="space-y-0.5 text-xs text-black/60">
            <li><Glyph e="🏆" /> {c.reward_mode === "ranked" ? (prizes ?? []).filter((p) => p.challenge_id === c.id).map((p) => `#${p.place}: ${p.points}`).join(" · ") + (c.points ? ` · ${t("taking part")}: ${c.points}` : "") : t("+{n} points", { n: c.points })}</li>
            <li><Glyph e="📅" /> {formatDateTime(c.starts_at)} → {formatDateTime(c.ends_at)}</li>
            <li><Glyph e="📝" /> {PROOF.filter((p) => c.proof_kinds.includes(p.id)).map((p) => t(p.label)).join(", ")}</li>
            <li><Glyph e="👥" /> {c.audience === "school" ? t("Whole school") : c.audience === "grade" ? t("Grade {g}", { g: c.audience_grade ?? "" }) : t("Class {g}{s}", { g: c.audience_grade ?? "", s: c.audience_section ?? "" })}{c.max_participants ? ` · ${t("max {n} students", { n: c.max_participants })}` : ""}</li>
          </ul>
          {govern ? <IdeaDecision id={c.id} locale={locale} /> : <p className="text-xs text-black/50">{t("Only the Student Council and admins can approve ideas.")}</p>}
        </article>
      )))}

      {tab === "entries" && ((waiting ?? []).length === 0 ? <p className="card p-4 text-sm text-black/55">{t("No entries are waiting.")}</p> : (
        <ul className="card divide-y divide-black/5 text-sm">
          {(waiting ?? []).map((e) => (
            <li key={e.id}><Link href={`/challenges/${e.challenge?.id}/manage`} className="flex items-center gap-2 px-4 py-3 hover:bg-black/[0.02]">
              <span><Glyph e={e.challenge?.emoji} /></span>
              <span className="min-w-0 flex-1"><strong>{e.student?.full_name}</strong> <span className="text-black/50">· {e.challenge?.title}</span></span>
              <span className="text-xs text-black/45">{timeAgo(e.created_at)}</span>
            </Link></li>
          ))}
        </ul>
      ))}

      {tab === "activity" && (
        <ul className="card divide-y divide-black/5 text-xs">
          {(activity ?? []).map((h) => (
            <li key={h.id} className="px-4 py-2"><strong>{h.actor?.full_name ?? t("Someone")}</strong> {t(ACTIONS[h.action] ?? h.action)} {h.subject === "idea" ? t("the challenge") : t("an entry in")} <Link href={`/challenges/${h.challenge?.id}`} className="underline">{h.challenge?.title}</Link>
              <span className="text-black/45"> · {timeAgo(h.created_at)}</span>{h.note && <span className="block text-black/55">“{h.note}”</span>}</li>
          ))}
        </ul>
      )}

      {tab === "flags" && ((flags ?? []).length === 0 ? <p className="card p-4 text-sm text-black/55">{t("Nothing unusual right now.")}</p> : (
        <ul className="card divide-y divide-black/5 text-sm">
          {(flags ?? []).map((f, i) => (
            <li key={i} className="px-4 py-3"><strong>{f.full_name}</strong> <span className="text-black/55">· {f.n} {t(f.detail)}</span><p className="text-xs text-amber-800">{t(FLAGS[f.kind] ?? f.kind)}</p></li>
          ))}
        </ul>
      ))}
    </div>
  );
}

export default function ReviewPage(props: PageProps<"/challenges/review">) {
  return (
    <>
      <PageHeader title="Review challenges" back="/challenges" />
      <Suspense fallback={<PageSkeleton />}><Review searchParams={props.searchParams} /></Suspense>
    </>
  );
}
