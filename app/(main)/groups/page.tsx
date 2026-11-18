import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { joinGroup } from "@/app/actions/community";
import { ActionForm } from "@/components/action-form";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Groups" };

async function Groups({ searchParams }: { searchParams: PageProps<"/groups">["searchParams"] }) {
  const me = await requireMe();
  const { q: rawQ } = await searchParams;
  const q = typeof rawQ === "string" ? rawQ.trim().slice(0, 40) : "";
  const supabase = await createClient();
  const { t } = await getT();
  let query = supabase.from("groups").select("id, name, description, emoji, kind, privacy, member_count").eq("status", "active").order("member_count", { ascending: false }).limit(100);
  if (q) query = query.ilike("name", `%${q.replace(/[%_]/g, "")}%`);
  const [{ data: groups }, { data: mine }] = await Promise.all([
    query,
    supabase.from("group_members").select("group_id, status").eq("profile_id", me.id),
  ]);
  const status = new Map((mine ?? []).map((m) => [m.group_id, m.status]));
  const sorted = [...(groups ?? [])].sort((a, b) => Number(status.get(b.id) === "active") - Number(status.get(a.id) === "active"));

  return (
    <div className="space-y-4">
      <form role="search" className="flex gap-2">
        <input name="q" defaultValue={q} maxLength={40} placeholder={t("Search groups")} aria-label={t("Search groups")} className="input flex-1" />
        <button className="btn-secondary">{t("Search")}</button>
      </form>
      {sorted.length === 0 ? (
        <EmptyState scene="community" title={t(q ? "No groups found" : "No groups yet? Be the first to start one!")} action={{ href: "/groups/new", label: t("Create a Group") }}>{t("Find your people. Explore communities built around your interests.")}</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sorted.map((g) => {
            const st = status.get(g.id);
            return (
              <article key={g.id} className="card flex flex-col gap-2 p-4" data-group={g.name}>
                <Link href={`/groups/${g.id}`} className="flex items-start gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-2xl">{g.emoji}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold hover:underline">{g.name}</span>
                    <span className="flex flex-wrap gap-1 text-xs text-black/50">
                      {g.kind === "official" && <span className="chip bg-brand-50 text-brand-800">{t("Official")}</span>}
                      <span className="chip">{g.privacy === "private" ? `🔒 ${t("Private")}` : t("Public")}</span>
                      <span>{t("{n} members", { n: g.member_count })}</span>
                    </span>
                  </span>
                </Link>
                {g.description && <p className="line-clamp-2 text-sm text-black/60">{g.description}</p>}
                <div className="mt-auto">
                  {st === "active" ? (
                    <Link href={`/groups/${g.id}`} className="btn-secondary w-full">{t("Open")}</Link>
                  ) : st === "pending" ? (
                    <span className="chip w-full justify-center bg-amber-50 py-2 text-amber-900">{t("Request sent")}</span>
                  ) : me.isStudent && !me.isSuspended ? (
                    <ActionForm action={joinGroup}>
                      <input type="hidden" name="groupId" value={g.id} />
                      <SubmitButton className="btn-primary w-full" pendingText="…">{g.privacy === "private" ? t("Ask to join") : t("Join")}</SubmitButton>
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
    <>
      <PageHeader title="Groups" back="/community" action={<Link href="/groups/new" className="btn-primary px-3 py-2">New group</Link>} />
      <Suspense fallback={<PageSkeleton />}>
        <Groups searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
