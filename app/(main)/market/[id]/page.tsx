import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { signImages } from "@/lib/images";
import { timeAgo } from "@/lib/time";
import { CATEGORIES, CONDITIONS, priceLabel } from "@/lib/market";
import { deleteListing, setListingStatus } from "@/app/actions/market";
import { startChat } from "@/app/actions/messages";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { ReportButton } from "@/components/report-button";
import { MarketSafetyNote } from "@/components/safety-note";
import { PageSkeleton } from "@/components/skeleton";
import { SubmitButton } from "@/components/submit-button";

async function Listing({ params }: { params: PageProps<"/market/[id]">["params"] }) {
  const { id } = await params;
  const me = await requireMe();
  const supabase = await createClient();
  const { data: l } = await supabase
    .from("listings")
    .select("*, seller:profiles(id, full_name, avatar, grade)")
    .eq("id", id)
    .maybeSingle();
  if (!l) notFound();
  const urls = await signImages(supabase, [l.image_path]);
  const url = l.image_path ? urls.get(l.image_path) : null;
  const mine = l.seller_id === me.id;

  return (
    <div className="space-y-4">
      <PageHeader title={l.title} back="/market" action={!mine && <ReportButton targetType="listing" targetId={l.id} compact />} />
      {l.status === "held" && (
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Only you can see this. A moderator is checking it.</p>
      )}
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="max-h-96 w-full rounded-2xl bg-black/5 object-cover" />
      )}
      <div className="card space-y-3 p-4">
        <div className="flex items-baseline justify-between">
          <p className="text-2xl font-bold text-brand-800">{priceLabel(l)}</p>
          <span className="chip">{l.status === "active" ? "Available" : l.status === "reserved" ? "Reserved" : l.status === "sold" ? "Sold" : "Checking"}</span>
        </div>
        <p className="text-sm text-black/55">{CATEGORIES[l.category]} · {CONDITIONS[l.condition]} · {timeAgo(l.created_at)}</p>
        {l.description && <p className="whitespace-pre-wrap">{l.description}</p>}
        {l.seller && (
          <Link href={`/profile/${l.seller.id}`} className="flex items-center gap-2 border-t border-black/5 pt-3 text-sm">
            <Avatar avatar={l.seller.avatar} size="sm" />
            <span className="font-semibold">{l.seller.full_name}</span>
            <span className="text-black/45">Grade {l.seller.grade}</span>
          </Link>
        )}
      </div>

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
      ) : (
        l.status !== "sold" && me.isStudent && !me.isSuspended && (
          <form action={startChat}>
            <input type="hidden" name="profileId" value={l.seller_id} />
            <SubmitButton className="btn-primary w-full py-3" pendingText="Opening…">💬 Message the seller</SubmitButton>
          </form>
        )
      )}
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
