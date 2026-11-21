import Link from "next/link";

export type MyPoints = { xp: number; spent: number; balance: number; level: number; level_start: number; next_level: number; level_name?: string; lifetime?: number; badges?: number; badges_total?: number };

// Level, XP bar and spendable balance.
export function LevelCard({ p, week, t }: { p: MyPoints; week: number; t: (s: string, v?: Record<string, string | number>) => string }) {
  const span = Math.max(1, p.next_level - p.level_start);
  const pct = Math.min(100, Math.round(((p.xp - p.level_start) / span) * 100));
  return (
    <div className="card overflow-hidden">
      <div className="bg-brand-700 p-4 text-white">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-white/75">{t("Level")}</p>
            <p className="text-4xl font-bold tabular-nums" data-testid="level">{p.level}</p>
            {p.level_name && <p className="text-sm font-semibold text-white/90" data-testid="level-name">{t(p.level_name)}</p>}
          </div>
          <div className="text-end">
            <p className="text-xs text-white/75">{t("To spend")}</p>
            <p className="text-2xl font-bold tabular-nums" data-testid="balance">{p.balance}</p>
          </div>
        </div>
        <div className="mt-3 h-2.5 rounded-full bg-white/25" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={t("Progress to the next level")}>
          <div className="h-2.5 rounded-full bg-white" style={{ width: `${Math.max(3, pct)}%` }} />
        </div>
        <p className="mt-1 text-xs text-white/80 tabular-nums">
          {t("{xp} XP · {n} more for level {l}", { xp: p.xp, n: p.next_level - p.xp, l: p.level + 1 })}
        </p>
      </div>
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
        <span>{t("This week")}: <strong className="tabular-nums">{week}</strong></span>
        <Link href="/shop" className="btn-secondary px-3 py-1.5">{t("Reward Shop")}</Link>
      </div>
    </div>
  );
}
