import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageSkeleton } from "@/components/skeleton";

// "@name" links land here and are sent on to the profile.
async function Go({ params }: { params: PageProps<"/u/[handle]">["params"] }) {
  await requireMe();
  const { handle } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id").eq("handle", handle.toLowerCase()).maybeSingle();
  if (!data) notFound();
  redirect(`/profile/${data.id}`);
  return null;
}

export default function HandlePage(props: PageProps<"/u/[handle]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Go params={props.params} />
    </Suspense>
  );
}
