import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AdminNav } from "@/components/admin-nav";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { signImages } from "@/lib/images";
import { Top10Forms } from "./top10-forms";

export const metadata = { title: "Top 10 Prizes" };

// The Reward Shop (spending points) is postponed; see _postponed/rewards-redeem. For now this page manages the Top 10 prizes.
async function Rewards() {
  const me = await requireMe();
  const supabase = await createClient();
  const { data: roles } = await supabase.from("leadership_roles").select("kind").eq("profile_id", me.id).eq("kind", "school_staff");
  if (!me.isAdmin && (roles ?? []).length === 0) return <p className="card p-4 text-sm text-black/60">Only admins and school staff can open this page.</p>;
  const [{ data: t10settings }, { data: t10prizes }] = await Promise.all([
    supabase.from("top10_settings").select("period, rules").maybeSingle(),
    supabase.from("top10_prizes").select("place, title, description, value, special, image_path").order("place"),
  ]);
  const images = await signImages(supabase, (t10prizes ?? []).map((x) => x.image_path));
  return (
    <div className="space-y-4">
      <Top10Forms settings={t10settings} schoolId={me.school_id} userId={me.id}
        prizes={(t10prizes ?? []).map((x) => ({ place: x.place, title: x.title, description: x.description, value: x.value, special: x.special, image: x.image_path ? images.get(x.image_path) ?? null : null }))} />
    </div>
  );
}

export default function AdminRewardsPage() {
  return (
    <>
      <PageHeader title="Admin" />
      <AdminNav current="/admin/rewards" />
      <Suspense fallback={<PageSkeleton />}>
        <Rewards />
      </Suspense>
    </>
  );
}
