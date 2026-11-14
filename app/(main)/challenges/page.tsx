import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { signImages } from "@/lib/images";
import { CATEGORIES, ENTRY_STATUS, KINDS } from "@/lib/challenges";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { ChallengeCard } from "./challenge-card";

export const metadata = { title: "Challenges" };

const SELECT = "id, title, emoji, points, reward_mode, kind, category, status, starts_at, ends_at, ranked_at, max_participants, cover_path, created_by";

async function Challenges({ searchParams }: { searchParams: PageProps<"/challenges">["searchParams"] }) {
  const me = await requireMe();
  const { tab: rawTab, category, kind } = await searchParams;
  const tab = rawTab === "joined" || rawTab === "done" || rawTab === "created" ? rawTab : "discover";
  const supabase = await createClient();
  const { t } = await getT();
  const now = new Date().toISOString();

  const { data: ledger } = await supabase.from("points_ledger").select("points").in("reason", ["challenge", "challenge_rank"]).eq("profile_id", me.id);
  const earned = (ledger ?? []).reduce((a, r) => a + r.points, 0);

  type Row = { id: string; title: string; emoji: string; points: number; reward_mode: string; kind: string; category: string; status: string; starts_at: string; ends_at: string; ranked_at: string | null; max_participants: number | null; cover_path: string | null; created_by: string | null };
  let rows: Row[] = [];
  const notes = new Map<string, React.ReactNode>();

  if (tab === "discover") {
    let q = supabase.from("challenges").select(SELECT).eq("status", "approved").gt("ends_at", now).order("ends_at");
    if (CATEGORIES.some((c) => c.id === category)) q = q.eq("category", category as string);
    if (KINDS.some((k) => k.id === kind)) q = q.eq("kind", kind as string);
    rows = (await q.limit(60)).data ?? [];
  } else if (tab === "created") {
    rows = (await supabase.from("challenges").select(SELECT).eq("created_by", me.id).order("created_at", { ascending: false }).limit(60)).data ?? [];
  } else {
    const { data: mine } = await supabase.from("challenge_submissions").select("challenge_id, status, points_awarded, attempt").eq("profile_id", me.id).order("attempt");
    const { data: joined } = await supabase.from("challenge_participants").select("challenge_id").eq("profile_id", me.id);
    const done = new Set((mine ?? []).filter((s) => s.status === "approved").map((s) => s.challenge_id));
    const ids = [...new Set([...(joined ?? []).map((j) => j.challenge_id), ...(mine ?? []).map((s) => s.challenge_id)])];
    const wanted = ids.filter((id) => (tab === "done" ? done.has(id) : true));
    if (wanted.length) rows = (await supabase.from("challenges").select(SELECT).in("id", wanted).order("ends_at", { ascending: false })).data ?? [];
    if (tab === "joined") rows = rows.filter((r) => !done.has(r.id) || r.ends_at > now);
    for (const r of rows) {
      const entries = (mine ?? []).filter((s) => s.challenge_id === r.id);
      const last = entries[entries.length - 1];
      const pts = entries.reduce((a, s) => a + (s.points_awarded ?? 0), 0);
      notes.set(r.id, (
        <p className="flex flex-wrap items-center gap-2 text-xs">
          {last ? <span className={`chip ${ENTRY_STATUS[last.status].cls}`}>{t(ENTRY_STATUS[last.status].label)}</span> : <span className="text-black/50">{t("Joined. Send your proof!")}</span>}
          {pts > 0 && <span className="font-semibold text-brand-800">{t("+{n} points earned", { n: pts })}</span>}
        </p>
      ));
    }
  }

  const ids = rows.map((r) => r.id);
  const [{ data: counts }, { data: prizes }, covers] = await Promise.all([
    ids.length ? supabase.rpc("challenge_counts", { p_ids: ids }) : Promise.resolve({ data: [] }),
    ids.length ? supabase.from("challenge_prizes").select("challenge_id, points").in("challenge_id", ids) : Promise.resolve({ data: [] }),
    signImages(supabase, rows.map((r) => r.cover_path)),
  ]);
  const countOf = new Map((counts ?? []).map((c) => [c.challenge_id, c]));
  const top = (id: string) => Math.max(0, ...(prizes ?? []).filter((p) => p.challenge_id === id).map((p) => p.points));

  const link = (o: Record<string, string>) => `/challenges?${new URLSearchParams({ ...(tab !== "discover" ? { tab } : {}), ...o })}`;
  const tabs = [["discover", t("Discover")], ["joined", t("Joined")], ["done", t("Completed")], ["created", t("My ideas")]] as const;
  const empty = {
    discover: t("No open challenges right now. Why not suggest one?"),
    joined: t("You have not joined a challenge yet."),
    done: t("Challenges you complete will appear here."),
    created: t("Challenges you create will appear here. Everyone can suggest one!"),
  }[tab];

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="card flex items-center gap-3 p-4">
        <span className="text-2xl">🏆</span>
        <p className="flex-1 text-sm text-black/65">
          {t("You earned")} <strong className="text-brand-800">{earned}</strong> {t("points from challenges.")}{" "}
          <Link href="/points" className="underline">{t("See all my points")}</Link>
        </p>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-xl bg-black/5 p-1" role="tablist">
        {tabs.map(([id, label]) => (
          <Link key={id} role="tab" aria-selected={tab === id} href={id === "discover" ? "/challenges" : `/challenges?tab=${id}`} className={`flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium whitespace-nowrap ${tab === id ? "bg-white shadow-sm" : "text-black/55"}`}>{label}</Link>
        ))}
      </div>

      {tab === "discover" && (
        <div className="space-y-2">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Link href={link({ ...(kind ? { kind: String(kind) } : {}) })} className={`chip whitespace-nowrap ${!category ? "bg-brand-700 text-white" : "bg-black/5"}`}>{t("All")}</Link>
            {CATEGORIES.map((c) => (
              <Link key={c.id} href={link({ category: c.id, ...(kind ? { kind: String(kind) } : {}) })} className={`chip whitespace-nowrap ${category === c.id ? "bg-brand-700 text-white" : "bg-black/5"}`}>{c.emoji} {t(c.label)}</Link>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            <Link href={link({ ...(category ? { category: String(category) } : {}) })} className={`chip whitespace-nowrap ${!kind ? "bg-brand-700 text-white" : "bg-black/5"}`}>{t("All types")}</Link>
            {KINDS.map((k) => (
              <Link key={k.id} href={link({ kind: k.id, ...(category ? { category: String(category) } : {}) })} className={`chip whitespace-nowrap ${kind === k.id ? "bg-brand-700 text-white" : "bg-black/5"}`}>{t(k.label)}</Link>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <Empty emoji="🏁" title={empty}>
          {(tab === "discover" || tab === "created") && <Link href="/challenges/new" className="btn-primary mt-3 inline-flex">{t("Create a challenge")}</Link>}
        </Empty>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <ChallengeCard key={c.id} t={t} c={{ ...c, cover: c.cover_path ? covers.get(c.cover_path) : null }} prizeTop={top(c.id) || undefined}
              participants={countOf.get(c.id)?.participants ?? 0} approved={countOf.get(c.id)?.approved ?? 0} note={notes.get(c.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

async function WithHeader({ searchParams }: { searchParams: PageProps<"/challenges">["searchParams"] }) {
  const { t } = await getT();
  const me = await requireMe();
  const supabase = await createClient();
  const { data: govern } = await supabase.rpc("can_govern_challenges");
  return (
    <>
      <PageHeader title="Challenges" back="/more" action={<Link href="/challenges/new" className="btn-primary px-3 py-1.5 text-sm">+ {t("New")}</Link>} />
      {(me.isStaff || govern) && (
        <p className="mb-3 text-sm"><Link href="/challenges/review" className="text-brand-700 underline">{t("Review challenges and entries")}</Link></p>
      )}
      <Challenges searchParams={searchParams} />
    </>
  );
}

export default function ChallengesPage(props: PageProps<"/challenges">) {
  return (
    <Suspense fallback={<><PageHeader title="Challenges" back="/more" /><PageSkeleton /></>}>
      <WithHeader searchParams={props.searchParams} />
    </Suspense>
  );
}
