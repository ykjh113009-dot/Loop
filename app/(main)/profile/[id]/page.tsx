import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
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

  const [{ data: profile }, { data: interests }, { data: clubs }, { data: block }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, avatar, grade, bio, role, deactivated_at, onboarded_at").eq("id", id).maybeSingle(),
    supabase.from("profile_interests").select("interest:interests(slug, name, emoji)").eq("profile_id", id),
    supabase.from("club_members").select("role, club:clubs(id, name, emoji, status)").eq("profile_id", id),
    supabase.from("blocks").select("blocked_id").eq("blocker_id", me.id).eq("blocked_id", id).maybeSingle(),
  ]);
  if (!profile || profile.deactivated_at || !profile.onboarded_at) notFound();
  const isMe = profile.id === me.id;
  const blocked = !!block;

  return (
    <div className="space-y-4">
      <div className="card p-5 text-center">
        <Avatar avatar={profile.avatar} size="xl" className="mx-auto" />
        <h1 className="mt-3 text-xl font-bold">{profile.full_name}</h1>
        <p className="text-sm text-black/55">Grade {profile.grade}</p>
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
              {!blocked && !me.isSuspended && (
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
