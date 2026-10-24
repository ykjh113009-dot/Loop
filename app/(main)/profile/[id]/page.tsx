import { Suspense } from "react";
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

const ROLE_BADGE: Record<string, string | null> = { student: null, moderator: "🛡️ Moderator", admin: "⭐ School admin" };

async function Profile({ params, searchParams }: { params: PageProps<"/profile/[id]">["params"]; searchParams: PageProps<"/profile/[id]">["searchParams"] }) {
  const { id } = await params;
  const { error } = await searchParams;
  const me = await requireMe();
  const supabase = await createClient();

  const [{ data: profile }, { data: interests }, { data: clubs }, { data: block }, { data: badges }, { data: tutor }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, avatar, grade, bio, role, alumni_year, university, major, deactivated_at, onboarded_at")
      .eq("id", id)
      .maybeSingle(),
    supabase.from("profile_interests").select("interest:interests(slug, name, emoji)").eq("profile_id", id),
    supabase.from("club_members").select("role, club:clubs(id, name, emoji, status)").eq("profile_id", id),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", me.id).eq("blocked_id", id).maybeSingle(),
    supabase.from("profile_badges").select("earned_at, badge:badges(code, name, emoji, description, sort)").eq("profile_id", id),
    supabase.from("tutor_profiles").select("subjects, availability, active").eq("profile_id", id).maybeSingle(),
  ]);
  if (!profile || profile.deactivated_at || !profile.onboarded_at) notFound();
  const isMe = profile.id === me.id;
  const blocked = !!block;
  // Private messages are only between current students.
  const theyAreStudent = profile.role !== "counselor" && !profile.alumni_year;
  const canMessage = me.isStudent && theyAreStudent && !blocked && !me.isSuspended;
  const earned = (badges ?? []).map((b) => b.badge).filter((b) => !!b).sort((a, b) => a!.sort - b!.sort);

  return (
    <div className="space-y-4">
      <div className="card p-5 text-center">
        <Avatar avatar={profile.avatar} size="xl" className="mx-auto" />
        <h1 className="mt-3 text-xl font-bold">{profile.full_name}</h1>
        <p className="text-sm text-black/55">{personLabel(profile)}</p>
        {profile.alumni_year && (profile.major || profile.university) && (
          <p className="text-sm text-black/55">🎓 {[profile.major, profile.university].filter(Boolean).join(" · ")}</p>
        )}
        {ROLE_BADGE[profile.role] && <span className="chip mt-2 bg-brand-50 text-brand-800">{ROLE_BADGE[profile.role]}</span>}
        {profile.bio && <p className="mt-3 whitespace-pre-wrap text-black/75">{profile.bio}</p>}

        {isMe ? (
          <div className="mt-4 flex gap-2">
            <Link href="/profile/edit" className="btn-secondary flex-1">Edit profile</Link>
            <form action={signOut} className="flex-1">
              <button className="btn-ghost w-full">Sign out</button>
            </form>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {error === "chat" && <p className="text-sm text-red-700">You can&apos;t message this student right now.</p>}
            <div className="flex gap-2">
              {profile.role === "counselor" && me.isStudent && (
                <Link href="/counselor" className="btn-primary flex-1">🫶 Talk privately</Link>
              )}
              {canMessage && (
                <form action={startChat} className="flex-1">
                  <input type="hidden" name="profileId" value={profile.id} />
                  <SubmitButton className="btn-primary w-full" pendingText="Opening…">Message</SubmitButton>
                </form>
              )}
              <form action={toggleBlock} className={blocked ? "flex-1" : ""}>
                <input type="hidden" name="profileId" value={profile.id} />
                <input type="hidden" name="block" value={String(!blocked)} />
                <SubmitButton className="btn-secondary w-full" pendingText="…">{blocked ? "Unblock" : "Block"}</SubmitButton>
              </form>
              <div className="flex items-center">
                <ReportButton targetType="profile" targetId={profile.id} />
              </div>
            </div>
            {blocked && <p className="text-xs text-black/50">You blocked this student. Neither of you can send private messages to the other.</p>}
            {me.isAdmin && (
              <Link href={`/admin/students/${profile.id}`} className="block text-sm text-brand-700 underline">Manage account (admin)</Link>
            )}
          </div>
        )}
      </div>

      {earned.length > 0 && (
        <section>
          <h2 className="section-title">Badges</h2>
          <div className="flex flex-wrap gap-1.5">
            {earned.map((b) => (
              <span key={b!.code} className="chip bg-white shadow-sm" title={b!.description}>{b!.emoji} {b!.name}</span>
            ))}
          </div>
        </section>
      )}

      {tutor?.active && (
        <section>
          <h2 className="section-title">Peer tutor</h2>
          <Link href={`/tutors?subject=${encodeURIComponent(tutor.subjects[0])}`} className="card block p-3 text-sm">
            📚 Can help with <strong>{tutor.subjects.join(", ")}</strong>
            {tutor.availability && <span className="text-black/55"> · {tutor.availability}</span>}
          </Link>
        </section>
      )}

      {interests && interests.length > 0 && (
        <section>
          <h2 className="section-title">Interests</h2>
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
        <h2 className="section-title">Clubs</h2>
        {clubs?.filter((c) => c.club?.status === "approved").length ? (
          <div className="flex flex-wrap gap-1.5">
            {clubs.filter((c) => c.club?.status === "approved").map((c) => (
              <Link key={c.club!.id} href={`/clubs/${c.club!.id}`} className="chip bg-white shadow-sm">
                {c.club!.emoji} {c.club!.name}{c.role === "leader" && " · Leader"}
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-black/50">Not in any clubs yet.</p>
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
