import Link from "next/link";
import { categoryOf, challengePhase, kindOf, PHASE } from "@/lib/challenges";
import { formatShortDate } from "@/lib/time";
import type { T } from "@/lib/i18n";

type C = {
  id: string; title: string; emoji: string; points: number; reward_mode: string; kind: string; category: string;
  status: string; starts_at: string; ends_at: string; ranked_at: string | null; max_participants: number | null; cover?: string | null;
};

// One challenge in a list: what to do, what it pays, when it ends.
export function ChallengeCard({ c, t, prizeTop, participants = 0, approved = 0, note }: {
  c: C; t: T; prizeTop?: number; participants?: number; approved?: number; note?: React.ReactNode;
}) {
  const phase = challengePhase(c, approved);
  const cat = categoryOf(c.category);
  const reward = c.reward_mode === "ranked" ? t("Up to {n} points", { n: prizeTop ?? c.points }) : t("+{n} points", { n: c.points });
  return (
    <Link href={`/challenges/${c.id}`} className="card block overflow-hidden hover:bg-black/[0.02]">
      {c.cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.cover} alt="" loading="lazy" className="h-28 w-full object-cover" />
      )}
      <div className="space-y-1.5 p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{c.emoji}</span>
          <div className="min-w-0 flex-1">
            <h3 className="font-bold">{c.title}</h3>
            <p className="text-xs text-black/50">{cat.emoji} {t(cat.label)} · {t(kindOf(c.kind).label)}</p>
          </div>
          <span className={`chip shrink-0 ${PHASE[phase].cls}`}>{t(PHASE[phase].label)}</span>
        </div>
        <p className="flex flex-wrap gap-x-3 text-sm">
          <strong className="text-brand-800">{reward}</strong>
          <span className="text-black/55">{phase === "approved" ? t("starts {d}", { d: formatShortDate(c.starts_at) }) : t("until {d}", { d: formatShortDate(new Date(new Date(c.ends_at).getTime() - 1)) })}</span>
          <span className="text-black/55">{c.max_participants ? t("{a} of {b} joined", { a: participants, b: c.max_participants }) : t("{a} joined", { a: participants })}</span>
        </p>
        {note}
      </div>
    </Link>
  );
}
