import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadFeed } from "@/lib/feed";
import { getT } from "@/lib/i18n-server";
import { archiveGroup, joinGroup, leaveGroup, removeGroupMember, respondGroupRequest, setGroupRole, updateGroup } from "@/app/actions/community";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { contentPowers } from "@/lib/content-powers";
import { AdminControls } from "@/components/admin-controls";
import { FeedPostCard } from "@/components/dashboard/feed-post";
import { Empty } from "@/components/empty";
import { PageHeader } from "@/components/page-header";
import { ReportButton } from "@/components/report-button";
import { SpaceComposer } from "@/components/space-composer";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";
import { Glyph } from "@/components/glyph";
import { IconPicker } from "@/components/icon-picker";

export const metadata = { title: "Group" };

async function Group({ params, searchParams }: { params: PageProps<"/groups/[id]">["params"]; searchParams: PageProps<"/groups/[id]">["searchParams"] }) {
  const { id } = await params;
  const { tab: rawTab } = await searchParams;
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const { data: g } = await supabase.from("groups").select("id, name, description, emoji, kind, privacy, status, member_count").eq("id", id).maybeSingle();
  if (!g) notFound();
  const [{ data: membership }, { data: chat }] = await Promise.all([
    supabase.from("group_members").select("role, status").eq("group_id", id).eq("profile_id", me.id).maybeSingle(),
    supabase.from("conversations").select("id").eq("group_id", id).maybeSingle(),
  ]);
  const member = membership?.status === "active";
  const groupAdmin = member && (membership?.role === "owner" || membership?.role === "admin");
  const owner = member && membership?.role === "owner";
  const canRead = member || g.privacy === "public";
  const manage = groupAdmin || me.isAdmin;
  const tab = rawTab === "members" || (rawTab === "manage" && manage) ? rawTab : "posts";

  const tabs = [["posts", t("Posts")], ["members", t("Members")], ...(manage ? [["manage", t("Manage")]] : [])] as [string, string][];

  let posts: Awaited<ReturnType<typeof loadFeed>> = [];
  if (tab === "posts" && canRead) {
    const { data } = await supabase.from("posts").select("id").eq("group_id", id).eq("status", "visible").order("created_at", { ascending: false }).limit(40);
    posts = await loadFeed(supabase, me.id, { ids: (data ?? []).map((p) => p.id) });
    posts.sort((a, b) => Number(b.kind === "announcement") - Number(a.kind === "announcement"));
  }
  const { data: members } = tab === "members" || tab === "manage"
    ? await supabase.from("group_members").select("role, status, profile:profiles(id, full_name, avatar, grade)").eq("group_id", id).order("joined_at").limit(300)
    : { data: [] };
  const active = (members ?? []).filter((m) => m.status === "active" && m.profile);
  const pending = (members ?? []).filter((m) => m.status === "pending" && m.profile);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <section className="card p-4">
        <div className="flex items-start gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-3xl"><Glyph e={g.emoji} /></span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">{g.name}</h1>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-black/55">
              {g.kind === "official" && <span className="chip bg-brand-50 text-brand-800">{t("Official")}</span>}
              <span className="chip">{g.privacy === "private" ? `${t("Private")}` : t("Public")}</span>
              <span>{t("{n} members", { n: g.member_count })}</span>
              {g.status === "archived" && <span className="chip bg-red-50 text-red-800">{t("Closed")}</span>}
            </p>
          </div>
          {!member && <ReportButton targetType="group" targetId={g.id} compact />}
          {me.isStaff && <AdminControls kind="group" id={g.id} title={g.name} detail={g.description} {...contentPowers(me, "group")} next="/groups" compact />}
        </div>
        {g.description && <p className="mt-3 text-sm whitespace-pre-wrap text-black/75">{g.description}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {member && chat && <Link href={`/messages/${chat.id}`} className="btn-secondary"><Glyph e="💬" /> {t("Group chat")}</Link>}
          {member && !owner && (
            <form action={leaveGroup}><input type="hidden" name="groupId" value={g.id} /><button className="btn-ghost">{t("Leave")}</button></form>
          )}
          {!membership && me.isStudent && !me.isSuspended && g.status === "active" && (
            <ActionForm action={joinGroup}><input type="hidden" name="groupId" value={g.id} /><SubmitButton className="btn-primary" pendingText="…">{g.privacy === "private" ? t("Ask to join") : t("Join")}</SubmitButton></ActionForm>
          )}
          {membership?.status === "pending" && <span className="chip bg-amber-50 py-2 text-amber-900">{t("Request sent. Waiting for the group admins.")}</span>}
        </div>
      </section>

      <div className="flex gap-1 rounded-xl bg-black/5 p-1" role="tablist">
        {tabs.map(([key, label]) => (
          <Link key={key} role="tab" aria-selected={tab === key} href={`/groups/${id}?tab=${key}`} className={`flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-medium ${tab === key ? "bg-brand-700 text-white shadow-sm" : "text-black/55 hover:bg-sage-soft/60"}`}>{label}</Link>
        ))}
      </div>

      {tab === "posts" && (
        !canRead ? (
          <Empty emoji="🔒" title={t("This group is private")}>{t("Ask to join to read the posts. The group admins will answer your request.")}</Empty>
        ) : (
          <>
            {member && !me.isSuspended && <SpaceComposer type="group" spaceId={g.id} canAnnounce={!!manage} locale={locale} />}
            {posts.length === 0 ? <Empty emoji="💬" title={t("No posts yet")}>{t("Start the first discussion.")}</Empty> : (
              <div className="grid grid-cols-1 gap-3">{posts.map((p) => <FeedPostCard key={p.id} post={p} meId={me.id} locale={locale} staff={me.isStaff ? contentPowers(me, "post") : undefined} />)}</div>
            )}
          </>
        )
      )}

      {tab === "members" && (
        !canRead ? (
          <Empty emoji="🔒" title={t("This group is private")} />
        ) : (
          <>
            {manage && pending.length > 0 && (
              <section className="card p-4">
                <h2 className="font-semibold">{t("Requests to join")}</h2>
                <ul className="mt-2 divide-y divide-black/5">
                  {pending.map((m) => (
                    <li key={m.profile!.id} className="flex flex-wrap items-center gap-3 py-2">
                      <Avatar avatar={m.profile!.avatar} size="sm" />
                      <Link href={`/profile/${m.profile!.id}`} className="min-w-0 flex-1 truncate font-medium hover:underline">{m.profile!.full_name}</Link>
                      <ActionForm action={respondGroupRequest} className="flex gap-2">
                        <input type="hidden" name="groupId" value={g.id} /><input type="hidden" name="profileId" value={m.profile!.id} />
                        <SubmitButton name="decision" value="approve" className="btn-primary px-3 py-1.5" pendingText="…">{t("Accept")}</SubmitButton>
                        <SubmitButton name="decision" value="reject" className="btn-secondary px-3 py-1.5" pendingText="…">{t("Decline")}</SubmitButton>
                      </ActionForm>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <ul className="card divide-y divide-black/5">
              {active.map((m) => (
                <li key={m.profile!.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <Link href={`/profile/${m.profile!.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar avatar={m.profile!.avatar} size="sm" />
                    <span className="truncate font-medium">{m.profile!.full_name}</span>
                    {m.role !== "member" && <span className="chip bg-brand-50 text-brand-800">{m.role === "owner" ? t("Owner") : t("Admin")}</span>}
                  </Link>
                  {manage && m.role !== "owner" && m.profile!.id !== me.id && (
                    <div className="flex gap-1.5">
                      {owner && (
                        <ActionForm action={setGroupRole}>
                          <input type="hidden" name="groupId" value={g.id} /><input type="hidden" name="profileId" value={m.profile!.id} /><input type="hidden" name="role" value={m.role === "admin" ? "member" : "admin"} />
                          <SubmitButton className="btn-secondary px-2.5 py-1 text-xs" pendingText="…">{m.role === "admin" ? t("Remove admin") : t("Make admin")}</SubmitButton>
                        </ActionForm>
                      )}
                      <ActionForm action={removeGroupMember}>
                        <input type="hidden" name="groupId" value={g.id} /><input type="hidden" name="profileId" value={m.profile!.id} />
                        <SubmitButton className="btn-ghost px-2.5 py-1 text-xs text-red-700" pendingText="…">{t("Remove")}</SubmitButton>
                      </ActionForm>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )
      )}

      {tab === "manage" && manage && (
        <>
          <ActionForm action={updateGroup} className="card space-y-3 p-4">
            <input type="hidden" name="groupId" value={g.id} />
            <h2 className="font-semibold">{t("Group details")}</h2>
            <div className="space-y-3">
              <IconPicker defaultValue={g.emoji} label={t("Icon")} />
              <input name="name" defaultValue={g.name} required minLength={3} maxLength={60} className="input" aria-label={t("Group name")} />
            </div>
            <textarea name="description" defaultValue={g.description} maxLength={500} rows={3} className="input resize-none" aria-label={t("What is it about?")} />
            <select name="privacy" defaultValue={g.privacy} className="input" aria-label={t("Who can join?")}>
              <option value="public">{t("Public: anyone can join")}</option>
              <option value="private">{t("Private: people ask to join")}</option>
            </select>
            <SubmitButton className="btn-primary w-full">{t("Save")}</SubmitButton>
          </ActionForm>
          {(owner || me.isAdmin) && (
            <form action={archiveGroup} className="card space-y-2 border-red-200 p-4">
              <input type="hidden" name="groupId" value={g.id} />
              <h2 className="font-semibold text-red-800">{t("Close this group")}</h2>
              <p className="text-sm text-black/55">{t("Nobody can join or post any more. You cannot undo this yourself.")}</p>
              <button className="btn-danger">{t("Close group")}</button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

export default function GroupPage(props: PageProps<"/groups/[id]">) {
  return (
    <>
      <PageHeader title="Group" back="/groups" />
      <Suspense fallback={<PageSkeleton />}>
        <Group params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}
