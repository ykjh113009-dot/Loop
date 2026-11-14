import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { redeemReward } from "@/app/actions/community";
import { ActionForm } from "@/components/action-form";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";
import { formatDate } from "@/lib/time";
import type { MyPoints } from "@/components/level-card";

export const metadata = { title: "Rewards shop" };

async function Shop() {
  const me = await requireMe();
  const supabase = await createClient();
  const { t } = await getT();
  const [{ data: rewards }, { data: mine }, { data: my }] = await Promise.all([
    supabase.from("rewards").select("id, name, description, cost, kind, stock, per_student_limit").eq("active", true).order("cost"),
    supabase.from("reward_redemptions").select("id, reward_id, status, cost, note, created_at, reward:rewards(name)").eq("profile_id", me.id).order("created_at", { ascending: false }).limit(30),
    supabase.rpc("my_points"),
  ]);
  const p = my as unknown as MyPoints;
  const count = new Map<string, number>();
  for (const r of mine ?? []) if (r.status !== "cancelled") count.set(r.reward_id, (count.get(r.reward_id) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="card flex items-center justify-between p-4">
        <div>
          <p className="text-xs text-black/50">{t("To spend")}</p>
          <p className="text-3xl font-bold tabular-nums" data-testid="balance">{p.balance}</p>
        </div>
        <p className="max-w-[16rem] text-end text-xs text-black/55">{t("Spending points never lowers your level or your house's score.")}</p>
      </div>

      {(rewards ?? []).length === 0 && <Empty emoji="🎁" title={t("The shop is empty")}>{t("Your school has not added rewards yet.")}</Empty>}
      <div className="grid gap-3 sm:grid-cols-2">
        {(rewards ?? []).map((r) => {
          const have = count.get(r.id) ?? 0;
          const soldOut = r.stock !== null && r.stock <= 0;
          const done = have >= r.per_student_limit;
          return (
            <article key={r.id} className="card flex flex-col gap-2 p-4" data-reward={r.id}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold">{r.name}</h2>
                <span className="chip bg-brand-50 text-brand-800">{r.kind === "prize" ? t("Prize") : t("Unlockable")}</span>
              </div>
              {r.description && <p className="text-sm text-black/60">{r.description}</p>}
              <p className="text-xs text-black/45">{r.stock !== null ? t("{n} left", { n: r.stock }) : ""}</p>
              <ActionForm action={redeemReward} className="mt-auto">
                <input type="hidden" name="rewardId" value={r.id} />
                <SubmitButton className="btn-primary w-full" disabled={soldOut || done || p.balance < r.cost} pendingText="…">
                  {done ? t("You have it") : soldOut ? t("Sold out") : `${r.cost} ${t("points")}`}
                </SubmitButton>
              </ActionForm>
            </article>
          );
        })}
      </div>

      {(mine ?? []).length > 0 && (
        <section className="card p-4">
          <h2 className="font-semibold">{t("Your rewards")}</h2>
          <ul className="mt-2 divide-y divide-black/5 text-sm">
            {(mine ?? []).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
                <span className="min-w-0 flex-1 truncate font-medium">{r.reward?.name}</span>
                <span className={`chip ${r.status === "fulfilled" ? "bg-brand-50 text-brand-800" : r.status === "pending" ? "bg-amber-50 text-amber-900" : "bg-black/5"}`}>
                  {t(r.status === "fulfilled" ? "Ready" : r.status === "pending" ? "Waiting for staff" : "Cancelled")}
                </span>
                <span className="text-xs text-black/45">{formatDate(r.created_at)}</span>
                {r.note && <span className="w-full text-xs text-black/55">{r.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default function ShopPage() {
  return (
    <>
      <PageHeader title="Rewards shop" back="/points" />
      <Suspense fallback={<PageSkeleton />}>
        <Shop />
      </Suspense>
    </>
  );
}
