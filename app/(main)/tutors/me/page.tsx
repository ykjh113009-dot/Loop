import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { MyProfileForm } from "./my-profile-form";
import { MyDocuments } from "./my-documents";

export const metadata = { title: "My tutor profile" };

async function Me() {
  const me = await requireMe();
  const supabase = await createClient();
  const { locale } = await getT();
  const { data: x } = await supabase.from("tutor_profiles").select("subjects, about, qualifications, experience, format, days, hours, preferred_times, photo_path, active, approved_at").eq("profile_id", me.id).maybeSingle();
  if (!x || !x.approved_at) redirect("/tutors/apply");
  const { data: docs } = await supabase.from("tutor_application_documents").select("id, name, kind, public_on_profile").eq("profile_id", me.id).order("created_at");
  return (
    <div className="mx-auto max-w-2xl">
      <MyProfileForm locale={locale} schoolId={me.school_id} userId={me.id} current={x} />
      <MyDocuments docs={docs ?? []} locale={locale} schoolId={me.school_id} userId={me.id} />
    </div>
  );
}

export default function MyTutorProfilePage() {
  return (
    <>
      <PageHeader title="My tutor profile" back="/tutors" />
      <Suspense fallback={<PageSkeleton />}><Me /></Suspense>
    </>
  );
}
