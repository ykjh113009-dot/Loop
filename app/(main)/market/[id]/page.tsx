import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { getT } from "@/lib/i18n-server";
import { loadListingDetails } from "@/lib/market-details";
import { ListingPageView } from "@/components/market/listing-page-view";
import { deleteListing, setListingStatus } from "@/app/actions/market";
import { PageHeader } from "@/components/page-header";
import { MarketSafetyNote } from "@/components/safety-note";
import { PageSkeleton } from "@/components/skeleton";
import { SubmitButton } from "@/components/submit-button";

async function Listing({ params }: { params: PageProps<"/market/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireMe();
  const { locale } = await getT();
  const d = await loadListingDetails(id, me);
  if (!d) notFound();
  const mine = d.mine;
  const l = { id: d.id, status: d.status };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader title={d.title} back="/market" />
      {d.status === "held" && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Only you can see this. A moderator is checking it.</p>
      )}
      <div className="card p-4 md:p-6"><ListingPageView d={d} locale={locale} /></div>

      {mine ? (
        <div className="card space-y-2 p-4">
          <p className="text-sm font-semibold">Update your item</p>
          <div className="flex flex-wrap gap-2">
            {l.status !== "held" && (["active", "reserved", "sold"] as const).filter((s) => s !== l.status).map((s) => (
              <form key={s} action={setListingStatus}>
                <input type="hidden" name="id" value={l.id} />
                <input type="hidden" name="status" value={s} />
                <SubmitButton className="btn-secondary px-3 py-2" pendingText="…">
                  {s === "active" ? "Available again" : s === "reserved" ? "Mark reserved" : "Mark sold"}
                </SubmitButton>
              </form>
            ))}
            <form action={deleteListing}>
              <input type="hidden" name="id" value={l.id} />
              <SubmitButton className="btn-ghost px-3 py-2 text-red-600" pendingText="…">Delete</SubmitButton>
            </form>
          </div>
        </div>
      ) : null}
      <MarketSafetyNote />
    </div>
  );
}

export default function ListingPage(props: PageProps<"/market/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Listing params={props.params} />
    </Suspense>
  );
}
