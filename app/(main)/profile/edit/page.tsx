import { Suspense } from "react";
import { getT } from "@/lib/i18n-server";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signImages } from "@/lib/images";
import { PushToggle } from "@/components/push-toggle";
import { PageSkeleton } from "@/components/skeleton";
import { EditProfile } from "./edit-profile";

export const metadata = { title: "Edit profile" };

async function Edit() {
  const me = await requireMe();
  const supabase = await createClient();
  const { locale, t } = await getT();
  const [{ data: interests }, { data: mine }, urls] = await Promise.all([
    supabase.from("interests").select("id, slug, name, emoji").order("name"),
    supabase.from("profile_interests").select("interest_id").eq("profile_id", me.id),
    signImages(supabase, [me.photo_path, me.cover_path]),
  ]);
  return (
    <div className="space-y-5">
      <EditProfile
        schoolId={me.school_id}
        userId={me.id}
        locale={locale}
        profileHref={`/profile/${me.id}`}
        name={me.full_name}
        gradeNote={me.isStudent ? t("Your name comes from your school account. Only your school admin can change your grade ({n}).", { n: me.grade ?? "" }) : t("Your name comes from your school account.")}
        avatar={me.avatar_icon}
        photoUrl={me.photo_path ? urls.get(me.photo_path) ?? null : null}
        coverUrl={me.cover_path ? urls.get(me.cover_path) ?? null : null}
        bio={me.bio}
        interests={interests ?? []}
        picked={(mine ?? []).map((m) => m.interest_id)}
        section={me.section ?? ""}
        sectionLocked={!!me.section}
        skills={me.skills}
        subjects={me.favorite_subjects}
        accent={me.accent}
        mentor={me.isAlumni ? { university: me.university, major: me.major } : null}
      />
      <div className="mx-auto max-w-3xl"><PushToggle /></div>
    </div>
  );
}

export default function EditProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Edit />
    </Suspense>
  );
}
