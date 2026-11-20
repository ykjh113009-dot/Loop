import { InterestIcon } from "@/components/interest-icon";
import { Suspense } from "react";
import { toggleFollow, sendFriendRequest, unfriend, cancelFriendRequest, respondFriendRequest } from "@/app/actions/social";
import { ActionForm } from "@/components/action-form";
import { FeedPostCard } from "@/components/dashboard/feed-post";
import { ACCENTS } from "@/lib/accent";
import { loadFeed } from "@/lib/feed";
import { getT } from "@/lib/i18n-server";
import { levelName } from "@/lib/points";
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
import { ShieldCheck, Star, Users, UserPlus, UserCheck, Pencil, Settings, LogOut, UserRound, Zap, Tent, Heart, Sparkle } from "lucide-react";
import { timeAgo } from "@/lib/time";
import { ReportButton } from "@/components/report-button";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";

const ROLE_BADGE: Record<string, string | null> = { student: null, moderator: "Moderator", admin: "School admin", super_admin: "Super Admin" };

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
    supabase.from("profile_badges").select("earned_at, badge:badges(code, name, emoji, description, sort)").eq("profile_id", id).eq("pinned", true),
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
    supabase.rpc("profile_public_rewards", { p_profile: id }),
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

  const stat = "flex flex-col items-center gap-1 px-5 hover:opacity-80 sm:px-8";
  const connections = (friendsA ?? 0) + (friendsB ?? 0);
  const activity = posts.slice(0, 3);
  const approvedClubs = (clubs ?? []).filter((c) => c.club?.status === "approved");
  const levelNo = lvl ? (lvl as unknown as { level: number }).level : null;
  const card = "rounded-3xl border border-brand-700/10 bg-white/85 p-5 shadow-[0_1px_2px_rgba(40,60,40,0.04)]";
  return (
    <div className="mx-auto max-w-5xl space-y-5" data-profile-page data-wide>
      <section className="relative overflow-hidden rounded-3xl border border-brand-700/10 bg-[#f4f1e6] pb-6 shadow-[0_1px_2px_rgba(40,60,40,0.04)]" data-profile-hero>
        <div className="relative h-40 bg-cover sm:h-72" style={{ backgroundImage: `url(${cover || "/brand/default-cover.webp"})`, backgroundPosition: "center 20%" }} data-testid="cover">
          <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="absolute inset-x-0 -bottom-px h-10 w-full text-[#f4f1e6] sm:h-16" aria-hidden="true"><path fill="currentColor" d="M0 80V52C240 8 470 8 720 40S1190 72 1440 28V80Z" /></svg>
        </div>
        <div className="relative px-5 text-center">
          <div className="relative z-10 -mt-[72px] inline-block">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element -- private signed link
              <img src={photo} alt="" className="size-32 rounded-full border-[5px] border-white bg-white object-cover shadow-lg sm:size-36" style={{ outline: `2px solid ${accent.ring}` }} data-profile-photo />
            ) : (
              <Avatar avatar={profile.avatar} size="xl" className="!size-32 border-[5px] border-white shadow-lg sm:!size-36" />
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 sm:absolute sm:end-8 sm:top-7 sm:mt-0 sm:flex-nowrap" data-profile-badges>
            {ROLE_BADGE[profile.role] && <span className="inline-flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-5" aria-hidden="true" />{ROLE_BADGE[profile.role]}</span>}
            {levelNo !== null && <span className="inline-flex items-center gap-2 border-s border-brand-700/15 ps-6 text-sm font-medium first:border-0 first:ps-0 max-sm:border-0 max-sm:ps-0"><Star className="size-5 fill-brand-900" aria-hidden="true" />{t("Level {n}", { n: levelNo })} · {t(levelName(levelNo))}</span>}
          </div>
          <h1 className="mt-2 font-heading text-[30px] leading-tight font-semibold sm:text-[40px]">{profile.full_name}</h1>
          <p className="text-lg text-ink-2 sm:text-xl" dir="ltr">{label}</p>
          {profile.alumni_year && (profile.major || profile.university) && (
            <p className="text-sm text-black/55">🎓 {[profile.major, profile.university].filter(Boolean).join(" · ")}</p>
          )}
          {(house?.house || (roles ?? []).length > 0) && (
            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {house?.house && <span className="chip bg-sage-soft/70 text-brand-800" data-testid="house-chip">{house.house.emoji} {house.house.name}</span>}
              {(roles ?? []).map((r) => <span key={r.id} className="chip bg-sage-soft/70 text-brand-800">{leadershipLabel(r.kind, r.scope, r.club?.name)}</span>)}
            </div>
          )}
          <div className="mx-auto my-4 flex max-w-md items-center gap-3 text-brand-800/60" aria-hidden="true"><span className="h-px flex-1 bg-brand-700/15" /><Sparkle className="size-4" /><span className="h-px flex-1 bg-brand-700/15" /></div>
          <div className="flex items-stretch justify-center divide-x divide-brand-700/15 rtl:divide-x-reverse text-ink" data-profile-stats>
            <Link href={`/profile/${profile.id}/connections?tab=friends`} className={stat}><span className="flex items-center gap-2 text-xl font-semibold"><Users className="size-5 text-brand-800" aria-hidden="true" /><span className="tabular-nums">{connections}</span></span><span className="text-sm text-ink-2">{t("Friends")}</span></Link>
            <Link href={`/profile/${profile.id}/connections?tab=followers`} className={stat}><span className="flex items-center gap-2 text-xl font-semibold"><UserPlus className="size-5 text-brand-800" aria-hidden="true" /><span className="tabular-nums">{followers ?? 0}</span></span><span className="text-sm text-ink-2">{t("Followers")}</span></Link>
            <Link href={`/profile/${profile.id}/connections?tab=following`} className={stat}><span className="flex items-center gap-2 text-xl font-semibold"><UserCheck className="size-5 text-brand-800" aria-hidden="true" /><span className="tabular-nums">{following ?? 0}</span></span><span className="text-sm text-ink-2">{t("Following")}</span></Link>
          </div>

          {isMe ? (
            <div className="relative mt-5 flex flex-wrap items-center justify-center gap-3" data-profile-actions>
              <Link href="/profile/edit" className="btn-primary inline-flex items-center gap-2 rounded-full px-8 py-3 text-base"><Pencil className="size-[18px]" aria-hidden="true" />{t("Edit Profile")}</Link>
              <Link href="/settings" className="btn-secondary inline-flex items-center gap-2 rounded-full px-8 py-3 text-base"><Settings className="size-[18px]" aria-hidden="true" />{t("Settings")}</Link>
              <form action={signOut} className="sm:absolute sm:end-3 sm:top-1/2 sm:-translate-y-1/2">
                <button className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-[15px] text-ink-2 hover:bg-black/5"><LogOut className="size-[18px] rtl:rotate-180" aria-hidden="true" />{t("Sign out")}</button>
              </form>
            </div>
          ) : (
            <div className="mt-5 space-y-2">
              {error === "chat" && <p className="text-sm text-red-700">{t("You can't message this student right now.")}</p>}
              <div className="flex flex-wrap justify-center gap-2">
                {canConnect && (
                  <form action={toggleFollow}>
                    <input type="hidden" name="profileId" value={profile.id} />
                    <input type="hidden" name="follow" value={String(!iFollow)} />
                    <SubmitButton className={`rounded-full ${iFollow ? "btn-secondary" : "btn-primary"}`} pendingText="…">{iFollow ? t("Following") : t("Follow")}</SubmitButton>
                  </form>
                )}
                {canConnect && theyAreStudent && me.isStudent && (
                  friendship ? (
                    <ActionForm action={unfriend}>
                      <input type="hidden" name="profileId" value={profile.id} />
                      <SubmitButton className="btn-secondary rounded-full" pendingText="…">{t("Friends ✓")}</SubmitButton>
                    </ActionForm>
                  ) : request && request.from_id === me.id ? (
                    <ActionForm action={cancelFriendRequest}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <SubmitButton className="btn-secondary rounded-full" pendingText="…">{t("Request sent")}</SubmitButton>
                    </ActionForm>
                  ) : request ? (
                    <ActionForm action={respondFriendRequest}>
                      <input type="hidden" name="requestId" value={request.id} />
                      <input type="hidden" name="decision" value="accept" />
                      <SubmitButton className="btn-primary rounded-full" pendingText="…">{t("Accept friend request")}</SubmitButton>
                    </ActionForm>
                  ) : (
                    <ActionForm action={sendFriendRequest}>
                      <input type="hidden" name="profileId" value={profile.id} />
                      <SubmitButton className="btn-secondary rounded-full" pendingText="…">{t("Add friend")}</SubmitButton>
                    </ActionForm>
                  )
                )}
                {profile.role === "counselor" && me.isStudent && (
                  <Link href="/counselor" className="btn-primary rounded-full">🫶 {t("Talk privately")}</Link>
                )}
                {canMessage && (
                  <form action={startChat}>
                    <input type="hidden" name="profileId" value={profile.id} />
                    <SubmitButton className="btn-secondary rounded-full" pendingText="…">{t("Message")}</SubmitButton>
                  </form>
                )}
                <form action={toggleBlock}>
                  <input type="hidden" name="profileId" value={profile.id} />
                  <input type="hidden" name="block" value={String(!blocked)} />
                  <SubmitButton className="btn-ghost rounded-full" pendingText="…">{blocked ? t("Unblock") : t("Block")}</SubmitButton>
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
      </section>

      {earned.length === 0 && isMe && (
        <p className="text-xs text-black/45">{t("Only the badges you pick show here.")} <Link href="/points" className="underline">{t("Choose badges")}</Link></p>
      )}

      <section className={card} data-card="interests">
        <header className="mb-3 flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2.5 text-[20px] font-semibold"><Star className="size-6 fill-brand-900" aria-hidden="true" />{t("Interests")}</h2>
          {isMe && <Link href="/profile/edit" className="text-sm text-ink-2 hover:underline">{t("Select your interests")}</Link>}
        </header>
        {(interests ?? []).length > 0 ? (
          <div className="flex flex-wrap gap-2.5">
            {interests!.map((i) => i.interest && (
              <Link key={i.interest.slug} href={`/people?interest=${i.interest.slug}`} className="inline-flex items-center gap-2 rounded-full border border-brand-700/20 bg-white px-4 py-2 text-[15px] hover:bg-sage-soft/50">
                <InterestIcon slug={i.interest.slug} className="size-[18px] shrink-0 text-brand-800" />{i.interest.name}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-ink-2">{isMe ? t("Choose your interests so other students can find you.") : t("No interests added yet.")}</p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className={card} data-card="about">
          <header className="mb-3 flex items-center justify-between border-b border-brand-700/10 pb-3">
            <h2 className="flex items-center gap-2.5 text-[20px] font-semibold"><UserRound className="size-6 fill-brand-900" aria-hidden="true" />{t("About Me")}</h2>
            {isMe && <Link href="/profile/edit" aria-label={t("Edit Profile")} className="rounded-full p-1.5 text-brand-900 hover:bg-sage-soft/60"><Pencil className="size-5" aria-hidden="true" /></Link>}
          </header>
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink">{profile.bio || (isMe ? t("Tell your school a bit about yourself in Edit Profile.") : t("No introduction yet."))}</p>
          {profile.skills.length > 0 && <div className="mt-4"><h3 className="mb-1.5 text-sm font-semibold">{t("Skills and talents")}</h3><div className="flex flex-wrap gap-1.5">{profile.skills.map((x) => <span key={x} className="chip bg-sage-soft/60">{x}</span>)}</div></div>}
          {profile.favorite_subjects.length > 0 && <div className="mt-4"><h3 className="mb-1.5 text-sm font-semibold">{t("Favourite subjects")}</h3><div className="flex flex-wrap gap-1.5">{profile.favorite_subjects.map((x) => <span key={x} className="chip bg-sage-soft/60">{x}</span>)}</div></div>}
          {earned.length > 0 && <div className="mt-4"><h3 className="mb-1.5 text-sm font-semibold">{t("Badges")}</h3><div className="flex flex-wrap gap-1.5">{earned.map((b) => <span key={b!.code} className="chip bg-white shadow-sm" title={b!.description}>{b!.emoji} {b!.name}</span>)}</div></div>}
          {tutor?.active && (
            <Link href={`/tutors?subject=${encodeURIComponent(tutor.subjects[0])}`} className="mt-4 block rounded-2xl bg-sage-soft/40 p-3 text-sm">
              📚 <strong>{t("Peer tutor")}:</strong> {tutor.subjects.join(", ")}{tutor.availability && <span className="text-ink-2"> · {tutor.availability}</span>}
            </Link>
          )}
        </section>

        <section className={card} data-card="activity">
          <header className="mb-3 flex items-center justify-between border-b border-brand-700/10 pb-3">
            <h2 className="flex items-center gap-2.5 text-[20px] font-semibold"><Zap className="size-6 fill-brand-900" aria-hidden="true" />{t("Recent Activity")}</h2>
            {posts.length > 0 && <a href="#posts" className="inline-flex items-center gap-1 text-sm hover:underline">{t("See All")} →</a>}
          </header>
          {activity.length === 0 ? (
            <p className="text-sm text-ink-2">{t("No activity yet.")}</p>
          ) : (
            <ul className="space-y-4">
              {activity.map((p) => (
                <li key={p.id}>
                  <Link href={`/post/${p.id}`} className="flex items-center gap-3.5">
                    {photo
                      // eslint-disable-next-line @next/next/no-img-element -- private signed link
                      ? <img src={photo} alt="" className="size-12 shrink-0 rounded-full object-cover" />
                      : <Avatar avatar={profile.avatar} size="md" className="!size-12" />}
                    <span className="min-w-0">
                      <span className="block truncate text-[15px]"><strong>{profile.full_name}</strong> {t("posted")}: {p.body.slice(0, 70)}</span>
                      <span className="text-sm text-ink-2">{timeAgo(p.created_at)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className={card} data-card="clubs">
          <h2 className="mb-3 flex items-center gap-2.5 text-[20px] font-semibold"><Tent className="size-6 text-brand-900" aria-hidden="true" />{t("Clubs")}</h2>
          {approvedClubs.length ? (
            <div className="flex flex-wrap gap-2">
              {approvedClubs.map((c) => (
                <Link key={c.club!.id} href={`/clubs/${c.club!.id}`} className="chip bg-sage-soft/60 px-3.5 py-1.5 text-sm">
                  {c.club!.emoji} {c.club!.name}{c.role === "leader" && ` · ${t("Leader")}`}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-2">{t("Not in any clubs yet.")}</p>
          )}
        </section>
        {(volunteering ?? []).length > 0 && (
          <section className={card} data-card="volunteering">
            <h2 className="mb-3 flex items-center gap-2.5 text-[20px] font-semibold"><Heart className="size-6 text-brand-900" aria-hidden="true" />{t("Volunteering")}</h2>
            <p className="mb-2 text-sm font-semibold text-brand-800">{t("{n} verified hours", { n: volunteerHours })}</p>
            <div className="divide-y divide-brand-700/10 text-sm">
              {(volunteering ?? []).slice(0, 5).map((v, i) => (
                <p key={i} className="flex justify-between py-2"><span>{v.organization}</span><span className="text-ink-2">{Number(v.hours)} h</span></p>
              ))}
            </div>
          </section>
        )}
      </div>

      <section id="posts" className="scroll-mt-24">
        <h2 className="section-title">{t("Posts")}</h2>
        {posts.length === 0 ? (
          <p className="text-sm text-ink-2">{t("No posts yet.")}</p>
        ) : (
          <div className="mx-auto max-w-3xl space-y-4">
            {posts.map((p) => <FeedPostCard key={p.id} post={p} meId={me.id} locale={locale} wide />)}
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
