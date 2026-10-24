import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { PageSkeleton } from "@/components/skeleton";
import { ListingForm } from "./listing-form";

export const metadata = { title: "Post an item" };

async function NewListing() {
  const me = await requireMe();
  if (!me.isStudent || me.isSuspended) redirect("/market");
  return <ListingForm schoolId={me.school_id} userId={me.id} />;
}

export default function NewListingPage() {
  return (
    <>
      <PageHeader title="Post an item" back="/market" />
      <Suspense fallback={<PageSkeleton />}>
        <NewListing />
      </Suspense>
    </>
  );
}
