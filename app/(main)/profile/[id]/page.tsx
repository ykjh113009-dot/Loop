import { Suspense } from "react";
import { toggleFollow, sendFriendRequest, unfriend, cancelFriendRequest, respondFriendRequest } from "@/app/actions/social";
import { ActionForm } from "@/components/action-form";
import { FeedPostCard } from "@/components/dashboard/feed-post";
import { ACCENTS } from "@/lib/accent";
import { loadFeed } from "@/lib/feed";
import { getT } from "@/lib/i18n-server";
import { signImages } from "@/lib/images";
import { leadershipLabel } from "@/lib/leadership";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { personLabel } from "@/lib/people";
import { startChat } from "@/app/actions/messages";
import { toggleBlock } from "@/app/actions/profile";
import { signOut } from "@/app/actions/auth";
import { Avatar } from "@/components/avatar";
import { ReportButton } from "@/components/report-button";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";

const ROLE_BADGE: Record<string, string | null> = { student: null, moderator: "🛡️ Moderator", admin: "⭐ School admin", super_admin: "⭐ Super Admin" };

async function Profile({ params, searchParams }: { params: PageProps<"/profile/[id]">["params"]; searchParams: PageProps<"/profile/[id]">["searchParams"] }) {
  const { id } = await params;
  const { error } = await searchParams;
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const pair = [me.id, id].sort();

  const [
    { data: profile }, { data: interests }, { data: clubs }, { data: block }, { data: badges }, { data: tutor },
    { data: roles }, { count: followers }, { count: following }, { count: friendsA }, { count: friendsB },
    { data: iFollow }, { data: friendship }, { data: request }, { data: house }, { data: lvl },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, handle, avatar, photo_path, cover_path, accent, grade, section, bio, skills, favorite_subjects, role, alumni_year, university, major, deactivated_at, onboarded_at")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("profile_interests").select("interest:interests(slug, name, emoji)").eq("profile_id", id),
    supabase.from("club_members").select("role, club:clubs(id, name, emoji, status)").eq("profile_id", id),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", me.id).eq("blocked_id", id).maybeSingle(),
    supabase.from("profile_badges").select("earned_at, badge:badges(code, name, emoji, description, sort)").eq("profile_id", id),
    supabase.from("tutor_profiles").select("subjects, availability, active").eq("profile_id", id).maybeSingle(),
    supabase.from("leadership_roles").select("id, kind, scope, club:clubs(name)").eq("profile_id", id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("followed_id", id),
    supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", id),
    supabase.from("friendships").select("*", { count: "exact", head: true }).eq("a_id", id),
    supabase.from("friendships").select("*", { count: "exact", head: true }).eq("b_id", id),
    supabase.from("follows").select("followed_id").eq("follower_id", me.id).eq("followed_id", id).maybeSingle(),
    supabase.from("friendships").select("a_id").eq("a_id", pair[0]).eq("b_id", pair[1]).maybeSingle(),
    supabase.from("friend_requests").select("id, from_id").eq("status", "pending").or(`and(from_id.eq.${me.id},to_id.eq.${id}),and(from_id.eq.${id},to_id.eq.${me.id})`).maybeSingle(),
    supabase.from("profiles").select("grade, section").eq("id", id).maybeSingle().then(async ({ data: p }) => p?.grade && p.section
      ? supabase.from("house_classes").select("house:houses(name, emoji)").eq("grade", p.grade).eq("section", p.section).maybeSingle()
      : { data: null }),
    id === me.id ? supabase.rpc("my_points") : Promise.resolve({ data: null }),
  ]);
  if (!profile || profile.deactivated_at || !profile.onboarded_at) notFound();
  const isMe = profile.id === me.id;
  const blocked = !!block;
  // Private messages are only between current students.
  const theyAreStudent = profile.role !== "counselor" && !profile.alumni_year;
  const canMessage = me.isStudent && theyAreStudent && !blocked && !me.isSuspended;
  const canConnect = !isMe && !blocked && !me.isSuspended;
  const { data: volunteering } = await supabase.rpc("volunteer_history", { p_profile: id });
  const volunteerHours = (volunteering ?? []).reduce((a, v) => a + Number(v.hours), 0);
  const earned = (badges ?? []).map((b) => b.badge).filter((b) => !!b).sort((a, b) => a!.sort - b!.sort);
  const accent = ACCENTS[profile.accent] ?? ACCENTS.olive;
  const [urls, posts] = await Promise.all([
    signImages(supabase, [profile.photo_path, profile.cover_path]),
    loadFeed(supabase, me.id, { authorId: id, limit: 10 }),
  ]);
  const photo = profile.photo_path && urls.get(profile.photo_path);
  const cover = profile.cover_path && urls.get(profile.cover_path);
  const label = [personLabel(profile) + (profile.grade && profile.section ? profile.section : ""), profile.handle && `@${profile.handle}`].filter(Boolean).join(" · ");

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="card overflow-hidden text-center">
        <div
          className="h-28 bg-cover bg-center sm:h-36"
          style={{ backgroundImage: cover ? `url(${cover})` : accent.cover }}
          data-testid="cover"
        />
        <div className="px-5 pb-5">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element -- private signed link
            <img src={photo} alt="" className="mx-auto -mt-12 size-24 rounded-full border-4 border-white bg-white object-cover" style={{ outline: `2px solid ${accent.ring}` }} />
          ) : (
            <Avatar avatar={profile.avatar} size="xl" className="mx-auto -mt-12 border-4 border-white" />
          )}
          <h1 className="mt-3 text-xl font-bold">{profile.full_name}</h1>
          <p className="text-sm text-black/55" dir="ltr">{label}</p>
          {profile.alumni_year && (profile.major || profile.university) && (
            <p className="text-sm text-black/55">🎓 {[profile.major, profile.university].filter(Boolean).join(" · ")}</p>
          )}
          <div className="mt-2 flex flex-wrap justify-center gap-1.5">
            {ROLE_BADGE[profile.role] && <span className="chip bg-brand-50 text-brand-800">{ROLE_BADGE[profile.role]}</span>}
            {house?.house && <span className="chip bg-brand-50 text-brand-800" data-testid="house-chip">{house.house.emoji} {house.house.name}</span>}
            {lvl && <span className="chip bg-amber-50 text-amber-900">⭐ {t("Level {n}", { n: (lvl as unknown as { level: number }).level })}</span>}
            {(roles ?? []).map((r) => (
              <span key={r.id} className="chip bg-brand-50 text-brand-800">{leadershipLabel(r.kind, r.scope, r.club?.name)}</span>
            ))}
          </div>
          {profile.bio && <p className="mt-3 whitespace-pre-wrap text-black/75">{profile.bio}</p>}

          <div className="mt-4 flex justify-center gap-6 text-sm">
            <Link href={`/profile/${profile.id}/connections?tab=friends`} className="hover:underline"><strong className="tabular-nums">{(friendsA ?? 0) + (friendsB ?? 0)}</strong> {t("Friends")}</Link>
            <Link href={`/profile/${profile.id}/connections?tab=followers`} className="hover:underline"><strong className="tabular-nums">{followers ?? 0}</strong> {t("Followers")}</Link>
            <Link href={`/profile/${profile.id}/connections?tab=following`} className="hover:underline"><strong className="tabular-nums">{following ?? 0}</strong> {t("Following")}</Link>
          </div>

          {isMe ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/profile/edit" className="btn-secondary flex-1">{t("Edit profile")}</Link>
              <Link href="/settings" className="btn-secondary flex-1">{t("Settings")}</Link>
              <form action={signOut} className="flex-1">
                <button className="btn-ghost w-full">{t("Sign out")}</button>
              </form>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {error === "chat" && <p className="text-sm text-red-700">{t("You can't message this student right now.")}</p>}
              <div className="flex flex-wrap justify-center gap-2">
                {canConnect && (
                  <form action={toggleFollow}>
                    <input type="hidden" name="profileId" value={profile.id} />
                    <input type="hidden" name="follow" value={String(!iFollow)} />
                    <SubmitButton className={iFollow ? "btn-secondary" : "btn-primary"} pendingText="…">{iFollow ? t("Following") : t("Follow")}</SubmitButton>
                  </form>
                )}
                {canConnect && theyAreStudent && me.isStudent && (
                  friendship ? (
                    <ActionForm action={unfriend}>
                      <input type="hidden" name="profileId" value={profile.id} />
                      <SubmitButton className="btn-secondary" pendingText="…">{t("Friends ✓")}</SubmitButton>
                    </ActionForm>
                  ) : request && request.from_id === me.id ? (
                    <ActionForm action={cancelFriendRequest}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <SubmitButton className="btn-secondary" pendingText="…">{t("Request sent")}</SubmitButton>
                    </ActionForm>
                  ) : request ? (
                    <ActionForm action={respondFriendRequest}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="decision" value="accept" />
                      <SubmitButton className="btn-primary" pendingText="…">{t("Accept friend request")}</SubmitButton>
                    </ActionForm>
                  ) : (
                    <ActionForm action={sendFriendRequest}>
                      <input type="hidden" name="profileId" value={profile.id} />
                      <SubmitButton className="btn-secondary" pendingText="…">{t("Add friend")}</SubmitButton>
                    </ActionForm>
                  )
                )}
                {profile.role === "counselor" && me.isStudent && (
                  <Link href="/counselor" className="btn-primary">🫶 {t("Talk privately")}</Link>
                )}
                {canMessage && (
                  <form action={startChat}>
                    <input type="hidden" name="profileId" value={profile.id} />
                    <SubmitButton className="btn-secondary" pendingText="…">{t("Message")}</SubmitButton>
                  </form>
                )}
                <form action={toggleBlock}>
                  <input type="hidden" name="profileId" value={profile.id} />
                  <input type="hidden" name="block" value={String(!blocked)} />
                  <SubmitButton className="btn-ghost" pendingText="…">{blocked ? t("Unblock") : t("Block")}</SubmitButton>
                </form>
                <div className="flex items-center">
                  <ReportButton targetType="profile" targetId={profile.id} />
                </div>
              </div>
              {blocked && <p className="text-xs text-black/50">{t("You blocked this student. You are no longer connected and cannot message each other.")}</p>}
              {me.isAdmin && (
                <Link href={`/admin/students/${profile.id}`} className="block text-sm text-brand-700 underline">{t("Manage account (admin)")}</Link>
              )}
            </div>
          )}
        </div>
      </div>

      {earned.length > 0 && (
        <section>
          <h2 className="section-title">{t("Badges")}</h2>
          <div className="flex flex-wrap gap-1.5">
            {earned.map((b) => (
              <span key={b!.code} className="chip bg-white shadow-sm" title={b!.description}>{b!.emoji} {b!.name}</span>
            ))}
          </div>
        </section>
      )}

      {(profile.skills.length > 0 || profile.favorite_subjects.length > 0) && (
        <section className="grid gap-4 sm:grid-cols-2">
          {profile.skills.length > 0 && (
            <div>
              <h2 className="section-title">{t("Skills and talents")}</h2>
              <div className="flex flex-wrap gap-1.5">{profile.skills.map((x) => <span key={x} className="chip bg-white shadow-sm">{x}</span>)}</div>
            </div>
          )}
          {profile.favorite_subjects.length > 0 && (
            <div>
              <h2 className="section-title">{t("Favourite subjects")}</h2>
              <div className="flex flex-wrap gap-1.5">{profile.favorite_subjects.map((x) => <span key={x} className="chip bg-white shadow-sm">{x}</span>)}</div>
            </div>
          )}
        </section>
      )}

      {tutor?.active && (
        <section>
          <h2 className="section-title">{t("Peer tutor")}</h2>
          <Link href={`/tutors?subject=${encodeURIComponent(tutor.subjects[0])}`} className="card block p-3 text-sm">
            📚 <strong>{tutor.subjects.join(", ")}</strong>
            {tutor.availability && <span className="text-black/55"> · {tutor.availability}</span>}
          </Link>
        </section>
      )}

      {interests && interests.length > 0 && (
        <section>
          <h2 className="section-title">{t("Interests")}</h2>
          <div className="flex flex-wrap gap-1.5">
            {interests.map((i) => i.interest && (
              <Link key={i.interest.slug} href={`/people?interest=${i.interest.slug}`} className="chip bg-white shadow-sm">
                {i.interest.emoji} {i.interest.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">{t("Clubs")}</h2>
        {clubs?.filter((c) => c.club?.status === "approved").length ? (
          <div className="flex flex-wrap gap-1.5">
            {clubs.filter((c) => c.club?.status === "approved").map((c) => (
              <Link key={c.club!.id} href={`/clubs/${c.club!.id}`} className="chip bg-white shadow-sm">
                {c.club!.emoji} {c.club!.name}{c.role === "leader" && ` · ${t("Leader")}`}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-black/50">{t("Not in any clubs yet.")}</p>
        )}
      </section>

      {(volunteering ?? []).length > 0 && (
        <section>
          <h2 className="section-title">💚 {t("Volunteering")}</h2>
          <div className="card divide-y divide-black/5 text-sm">
            <p className="px-4 py-2.5 font-semibold text-brand-800">{t("{n} verified hours", { n: volunteerHours })}</p>
            {(volunteering ?? []).slice(0, 5).map((v, i) => (
              <p key={i} className="flex justify-between px-4 py-2"><span>{v.organization}</span><span className="text-black/50">{Number(v.hours)} h</span></p>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title">{t("Posts")}</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-black/50">{t("No posts yet.")}</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {posts.map((p) => <FeedPostCard key={p.id} post={p} meId={me.id} locale={locale} />)}
          </div>
        )}
      </section>
    </div>
  );
}

export default function ProfilePage(props: PageProps<"/profile/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Profile params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}
