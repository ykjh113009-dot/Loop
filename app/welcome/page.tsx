import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageSkeleton } from "@/components/skeleton";
import { WelcomeForm } from "./welcome-form";

export const metadata = { title: "Welcome" };

async function Welcome() {
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.deactivated_at) redirect("/removed");
  if (me.onboarded_at) redirect("/home");

  const supabase = await createClient();
  const { data: interests } = await supabase.from("interests").select("id, name, emoji").order("name");

  return (
    <>
      <div>
        <h1 className="text-2xl font-bold">Welcome, {me.full_name.split(" ")[0]}! 👋</h1>
        <p className="mt-1 text-black/60">Set up your profile for {me.school.name}. It takes 30 seconds.</p>
      </div>
      <WelcomeForm grades={me.school.grades} fixedGrade={me.grade} interests={interests ?? []} />
    </>
  );
}

export default function WelcomePage() {
  return (
    <main className="mx-auto max-w-md space-y-6 px-5 py-8">
      <Suspense fallback={<PageSkeleton />}>
        <Welcome />
      </Suspense>
    </main>
  );
}
