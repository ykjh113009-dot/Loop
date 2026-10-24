import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { RequestClubForm } from "./request-form";

export const metadata = { title: "Request a club" };

async function Gate() {
  const me = await requireMe();
  if (me.isSuspended) redirect("/clubs");
  return <RequestClubForm />;
}

export default function NewClubPage() {
  return (
    <>
      <PageHeader title="Request a club" back="/clubs" />
      <Suspense>
        <Gate />
      </Suspense>
    </>
  );
}
