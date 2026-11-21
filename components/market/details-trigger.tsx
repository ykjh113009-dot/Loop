"use client";

import { useRef, useState } from "react";
import { ArrowLeft, X } from "lucide-react";
import { ListingDetailsView } from "@/components/market/listing-details";
import { makeT, type Locale } from "@/lib/i18n";
import type { ListingDetails } from "@/lib/market-details";

// Wraps a listing card. Clicking its picture or "View Details" opens the item details:
// a centred window on a computer, the whole screen on a phone. The links still work as normal links (new tab, no script).
export function DetailsTrigger({ id, title, locale, className, children }: { id: string; title: string; locale: Locale; className?: string; children: React.ReactNode }) {
  const t = makeT(locale);
  const dialog = useRef<HTMLDialogElement>(null);
  const [data, setData] = useState<ListingDetails | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  async function load() {
    try {
      const res = await fetch(`/api/listing/${id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      setData((await res.json()) as ListingDetails);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  function open(e: React.MouseEvent<HTMLLIElement>) {
    const link = (e.target as HTMLElement).closest("a[data-details]");
    if (!link || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    e.stopPropagation(); // keep the link from also navigating
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    setStatus("loading");
    void load();
  }

  return (
    <li className={className} onClickCapture={open} data-listing={id}>
      {children}
      <dialog ref={dialog} onClick={(e) => { if (e.target === dialog.current) dialog.current?.close(); }} onClose={() => { document.body.style.overflow = ""; }}
        className="m-auto max-h-[92dvh] w-[min(94vw,62rem)] overflow-hidden rounded-3xl border border-brand-700/10 bg-cream p-0 text-ink shadow-2xl backdrop:bg-black/45 max-md:m-0 max-md:h-dvh max-md:max-h-none max-md:w-screen max-md:max-w-none max-md:rounded-none max-md:border-0"
        aria-label={title} data-details-dialog>
        <div className="flex max-h-[92dvh] flex-col max-md:h-dvh max-md:max-h-none">
          {/* Phone: a bar with Back and the item name. Computer: a close button in the corner. */}
          <div className="flex shrink-0 items-center gap-2 border-b border-black/5 px-2 py-2 md:hidden">
            <button type="button" onClick={() => dialog.current?.close()} className="flex size-11 items-center justify-center rounded-full hover:bg-black/5" aria-label={t("Back")}><ArrowLeft className="size-5 rtl:rotate-180" aria-hidden="true" /></button>
            <p className="min-w-0 flex-1 truncate font-semibold">{title}</p>
          </div>
          <button type="button" onClick={() => dialog.current?.close()} className="absolute end-4 top-4 z-20 flex size-10 items-center justify-center rounded-full bg-white/90 text-ink shadow hover:bg-white max-md:hidden" aria-label={t("Close")} data-close-details><X className="size-5" aria-hidden="true" /></button>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6">
            {data ? <ListingDetailsView d={data} locale={locale} onChanged={() => void load()} onBack={() => dialog.current?.close()} />
              : status === "error" ? <p className="py-10 text-center text-sm text-red-700">{t("We could not open this item. Try again.")}</p>
              : <div className="grid gap-5 md:grid-cols-2" aria-busy="true"><div className="aspect-[4/3] animate-pulse rounded-2xl bg-black/[0.06]" /><div className="space-y-3"><div className="h-8 w-2/3 animate-pulse rounded bg-black/[0.06]" /><div className="h-6 w-1/3 animate-pulse rounded bg-black/[0.06]" /><div className="h-20 animate-pulse rounded bg-black/[0.06]" /></div></div>}
          </div>
        </div>
      </dialog>
    </li>
  );
}
