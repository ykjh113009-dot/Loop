import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { joinGroup } from "@/app/actions/community";
import { ActionForm } from "@/components/action-form";
import { EmptyState } from "@/components/ui/empty-state";
import { Users, Search } from "lucide-react";
import { FeatureBanner } from "@/components/ui/feature-banner";
import { SectionTabs } from "@/components/ui/section-tabs";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";
import { Glyph } from "@/components/glyph";

export const metadata = { title: "Groups" };

const TABS = [["", "All Groups"], ["mine", "My Groups"], ["popular", "Popular"]] as const;

async function Groups({ searchParams }: { searchParams: PageProps<"/groups">["searchParams"] }) {
  const me = await requireMe();
  const { q: rawQ, tab: rawTab } = await searchParams;
  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, 40) : "";
  const tab = rawTab === "mine" || rawTab === "popular" ? rawTab : "";
  const supabase = await createClient();
  const { t } = await getT();
  let query = supabase.from("groups").select("id, name, description, emoji, kind, privacy, member_count").eq("status", "active").order("member_count", { ascending: false }).limit(100);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
  const [{ data: groups }, { data: mine }] = await Promise.all([
    query,
    supabase.from("group_members").select("group_id, status").eq("profile_id", me.id),
  ]);
  const status = new Map((mine ?? []).map((m) => [m.group_id, m.status]));
  let list = [...(groups ?? [])];
  if (tab === "mine") list = list.filter((g) => status.get(g.id) === "active");
  else if (tab === "popular") list = list.slice(0, 12);
  else list.sort((a, b) => Number(status.get(b.id) === "active") - Number(status.get(a.id) === "active"));
  const href = (k: string) => `/groups${k || q ? `?${new URLSearchParams({ ...(k ? { tab: k } : {}), ...(q ? { q } : {}) })}` : ""}`;

  return (
    <div className="space-y-5" data-groups-page data-wide>
      <FeatureBanner title={t("Groups")} subtitle={t("Find and join groups that match your interests!")} icon={Users} />
      <div className="flex flex-wrap items-center gap-3">
        <SectionTabs label={t("Groups")} current={href(tab)} items={TABS.map(([k, label]) => ({ href: href(k), label: t(label) }))} />
        <form role="search" className="relative ms-auto min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-4 -translate-y-1/2 text-ink-2" aria-hidden="true" />
          {tab && <input type="hidden" name="tab" value={tab} />}
          <input name="q" defaultValue={q} maxLength={40} placeholder={t("Search groups")} aria-label={t("Search groups")} className="input !rounded-full !ps-10" />
        </form>
        {!me.isSuspended && me.isStudent && <Link href="/groups/new" className="btn-primary rounded-full px-5 py-2.5">{t("Create a Group")}</Link>}
      </div>
      {list.length === 0 ? (
        <EmptyState scene="community" title={t(tab === "mine" ? "You have not joined a group yet" : q ? "No groups found" : "No groups yet? Be the first to start one!")} action={{ href: "/groups/new", label: t("Create a Group") }}>{t("Find your people. Explore communities built around your interests.")}</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((g) => {
            const st = status.get(g.id);
            return (
              <article key={g.id} className="flex flex-col items-center gap-2 rounded-3xl border border-brand-700/10 bg-white/85 p-5 text-center shadow-[0_1px_2px_rgba(40,60,40,0.04)]" data-group={g.name}>
                <Link href={`/groups/${g.id}`} className="flex flex-col items-center gap-2">
                  <span className="flex size-16 items-center justify-center rounded-full bg-sage-soft text-3xl" aria-hidden="true"><Glyph e={g.emoji} /></span>
                  <span className="text-[17px] font-semibold hover:underline">{g.name}</span>
                </Link>
                <p className="flex flex-wrap items-center justify-center gap-1.5 text-xs text-ink-2">
                  <span>{t("{n} members", { n: g.member_count })}</span>
                  {g.kind === "official" && <span className="chip bg-brand-50 text-brand-800">{t("Official")}</span>}
                  <span className="chip">{g.privacy === "private" ? `${t("Private")}` : t("Public")}</span>
                </p>
                {g.description && <p className="line-clamp-2 text-sm text-ink-2">{g.description}</p>}
                <div className="mt-auto w-full pt-2">
                  {st === "active" ? (
                    <Link href={`/groups/${g.id}`} className="btn-secondary w-full justify-center rounded-full">{t("Open")}</Link>
                  ) : st === "pending" ? (
                    <span className="chip w-full justify-center bg-amber-50 py-2 text-amber-900">{t("Request sent")}</span>
                  ) : me.isStudent && !me.isSuspended ? (
                    <ActionForm action={joinGroup}>
                      <input type="hidden" name="groupId" value={g.id} />
                      <SubmitButton className="btn-primary w-full rounded-full" pendingText="…">{g.privacy === "private" ? t("Ask to join") : t("Join Group")}</SubmitButton>
                    </ActionForm>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function GroupsPage(props: PageProps<"/groups">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Groups searchParams={props.searchParams} />
    </Suspense>
  );
}
