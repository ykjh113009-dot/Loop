import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";
import { AskForm } from "../forms";

export const metadata = { title: "Ask a question" };

async function Gate() {
  const me = await requireMe();
  if (me.isSuspended) redirect("/tawjihi");
  return <AskForm />;
}

export default function AskPage() {
  return (
    <>
      <PageHeader title="Ask a question" back="/tawjihi" />
      <Suspense>
        <Gate />
      </Suspense>
    </>
  );
}
