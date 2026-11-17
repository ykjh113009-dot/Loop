import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getLocale } from "@/lib/i18n-server";
import { WelcomeWizard } from "./welcome-wizard";

export const metadata = { title: "Welcome" };

async function Welcome() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.deactivated_at) redirect("/removed");
  if (me.onboarded_at) redirect("/home");

  const supabase = await createClient();
  const [{ data: interests }, { data: contact }, locale] = await Promise.all([
    supabase.from("interests").select("id, name").order("name"),
    supabase.from("private_profiles").select("email").eq("id", me.id).maybeSingle(),
    getLocale(),
  ]);
  return (
    <WelcomeWizard
      locale={locale}
      schoolId={me.school_id}
      userId={me.id}
      name={me.full_name}
      email={contact?.email ?? ""}
      schoolName={me.school.name}
      grades={me.school.grades}
      fixedGrade={me.grade}
      fixedSection={me.section}
      noClassReason={me.role === "counselor" ? "counselor" : me.alumni_year ? "alumni" : null}
      interests={interests ?? []}
    />
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-cream" />}>
      <Welcome />
    </Suspense>
  );
}
