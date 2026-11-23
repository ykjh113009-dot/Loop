"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Bookmark, BookmarkCheck, CalendarClock, Check, HandCoins, MapPin, MessageCircle, X } from "lucide-react";
import { respondOffer, setListingSaved, withdrawOffer, makeOffer } from "@/app/actions/market";
import { startChat } from "@/app/actions/messages";
import { Avatar } from "@/components/avatar";
import { ReportButton } from "@/components/report-button";
import { AdminControls } from "@/components/admin-controls";
import { Gallery } from "@/components/market/gallery";
import { makeT, type Locale } from "@/lib/i18n";
import type { ListingDetails } from "@/lib/market-details";
import type { ActionResult } from "@/lib/errors";

function Submit({ children, className }: { children: React.ReactNode; className: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={className}>{pending ? "…" : children}</button>;
}

// The offer form: a centred window on a computer, a sheet from the bottom on a phone.
function OfferSheet({ d, locale, onChanged, sheet }: { d: ListingDetails; locale: Locale; onChanged: () => void; sheet: React.RefObject<HTMLDialogElement | null> }) {
  const t = makeT(locale);
  const [result, setResult] = useState<ActionResult>(null);
  const done = !!result?.ok;
  return (
    <dialog ref={sheet} onClick={(e) => { if (e.target === sheet.current) sheet.current?.close(); }} onClose={() => { if (done) onChanged(); setResult(null); }}
      className="m-auto w-[min(92vw,26rem)] rounded-3xl border border-brand-700/10 bg-cream p-0 text-ink shadow-2xl backdrop:bg-black/40 max-md:mb-0 max-md:mt-auto max-md:w-full max-md:max-w-none max-md:rounded-b-none" aria-label={t("Make an Offer")} data-offer-sheet>
      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-heading text-xl font-semibold text-brand-900">{done ? t("Offer sent") : t("Make an Offer")}</h2>
          <button type="button" onClick={() => sheet.current?.close()} className="rounded-full p-1.5 text-ink-2 hover:bg-black/5" aria-label={t("Close")}><X className="size-5" aria-hidden="true" /></button>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm shadow-sm"><span className="text-ink-2">{t("Asking price")}</span><strong className="text-lg tabular-nums">{d.priceText}</strong></div>
        {done ? (
          <p className="flex items-start gap-2 rounded-2xl bg-sage-soft/60 p-3 text-sm text-brand-900"><Check className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{t(result?.message ?? "")}</p>
        ) : (
          <form action={async (fd) => { setResult(await makeOffer(null, fd)); }} className="space-y-3">
            <input type="hidden" name="listingId" value={d.id} />
            <label className="block text-sm"><span className="label">{t("Your offer (₪)")}</span>
              <input name="amount" type="number" inputMode="decimal" required min={1} max={d.price ?? undefined} step="any" defaultValue={d.myOffer?.amount ?? ""} className="input text-lg" placeholder={t("e.g. {n}", { n: Math.max(1, Math.round((d.price ?? 10) * 0.8)) })} data-offer-amount />
            </label>
            <label className="block text-sm"><span className="label">{t("Message")} <span className="font-normal text-black/45">({t("optional")})</span></span>
              <textarea name="message" rows={2} maxLength={300} defaultValue={d.myOffer?.message ?? ""} className="input resize-none" placeholder={t("Say hello, or when you can meet at school")} />
            </label>
            {result?.error && <p role="alert" className="text-sm text-red-700">{t(result.error)}</p>}
            <Submit className="btn-primary w-full rounded-full py-3"><HandCoins className="size-[18px]" aria-hidden="true" />{t("Send offer")}</Submit>
          </form>
        )}
        {done && <button type="button" onClick={() => sheet.current?.close()} className="btn-secondary w-full rounded-full">{t("Close")}</button>}
      </div>
    </dialog>
  );
}

// Everything about one listing: pictures, price, seller and the things a student can do. Used in the popup and on the full page.
export function ListingDetailsView({ d, locale, onChanged, onBack }: { d: ListingDetails; locale: Locale; onChanged: () => void; onBack?: () => void }) {
  const t = makeT(locale);
  const sheet = useRef<HTMLDialogElement>(null);
  const [saved, setSaved] = useState(d.saved);
  const [error, setError] = useState<string | null>(null);
  const [offerMsg, setOfferMsg] = useState<string | null>(null);
  const available = d.status === "active" || d.status === "reserved";

  async function toggleSave() {
    const next = !saved;
    setSaved(next);
    setError(null);
    const r = await setListingSaved(d.id, next);
    if (r?.error) { setSaved(!next); setError(r.error); }
  }

  const statusNote = d.status === "sold" ? t("Sold") : d.status === "reserved" ? t("Reserved") : d.status === "held" ? t("Checking") : null;
  const primaryOffer = d.canOffer && !d.myOffer;
  const messageForm = (cls: string, label: string, icon = true) => (
    <form action={startChat}>
      <input type="hidden" name="profileId" value={d.seller.id} />
      <Submit className={cls}>{icon && <MessageCircle className="size-[18px]" aria-hidden="true" />}{label}</Submit>
    </form>
  );

  return (
    <div className="grid gap-5 md:grid-cols-[1.05fr_1fr] md:gap-7" data-listing-details={d.id}>
      <div className="min-w-0"><Gallery images={d.images} alt={d.title} labels={{ prev: t("Previous picture"), next: t("Next picture"), none: t("No pictures yet"), picture: (n) => t("Picture {n}", { n }) }} /></div>

      <div className="flex min-w-0 flex-col gap-4">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-heading text-2xl leading-tight font-semibold text-brand-900 md:pe-8 md:text-3xl" data-listing-title>{d.title}</h2>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-2xl font-bold text-brand-800 md:text-3xl" data-listing-price>{d.priceText}</p>
            <span className="chip border-brand-700/15 bg-sage-soft/60 px-3 py-1 text-sm text-brand-900" data-listing-condition>{d.conditionText}</span>
          </div>
          {statusNote && <p className="mt-2 inline-block rounded-full bg-gold-soft px-3 py-1 text-xs font-medium text-ink">{statusNote}</p>}
        </div>

        {d.description && <p className="whitespace-pre-wrap text-[15px] text-ink-2" data-listing-description>{d.description}</p>}

        <div className="space-y-3 border-y border-black/10 py-3">
          <div className="flex items-center gap-3">
            <Link href={`/profile/${d.seller.id}`} className="flex min-w-0 flex-1 items-center gap-3" data-seller-link>
              <Avatar avatar={d.seller.avatar} size="md" />
              <span className="min-w-0"><span className="block truncate font-semibold">{d.seller.name}</span>{d.seller.grade && <span className="text-sm text-ink-2">{t("Grade {n}", { n: d.seller.grade })}</span>}</span>
            </Link>
            {!d.mine && d.canAct && available && (
              <form action={startChat}>
                <input type="hidden" name="profileId" value={d.seller.id} />
                <button className="flex size-11 items-center justify-center rounded-full bg-sage-soft/70 text-brand-800 hover:bg-sage-soft" aria-label={t("Message Seller")}><MessageCircle className="size-5" aria-hidden="true" /></button>
              </form>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-2">
            <span className="inline-flex items-center gap-1.5"><CalendarClock className="size-4" aria-hidden="true" />{d.posted}</span>
            {d.location && <span className="inline-flex items-center gap-1.5"><MapPin className="size-4" aria-hidden="true" />{d.location}</span>}
            <span>{d.categoryText}</span>
          </div>
        </div>

        {d.mine ? (
          <div className="space-y-3" data-owner-offers>
            <p className="text-sm font-semibold">{t("This is your listing")}</p>
            {d.kind === "sell" && (d.offers.length === 0 ? <p className="text-sm text-ink-2">{t("No offers yet.")}</p> : (
              <ul className="space-y-2">
                {d.offers.map((o) => (
                  <li key={o.id} className="space-y-2 rounded-2xl bg-white p-3 shadow-sm" data-offer={o.id}>
                    <div className="flex items-center gap-2"><Avatar avatar={o.avatar} size="sm" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{o.name}</span><strong className="tabular-nums">₪{o.amount}</strong></div>
                    {o.message && <p className="text-sm text-ink-2">“{o.message}”</p>}
                    <form action={async (fd) => { const r = await respondOffer(null, fd); setOfferMsg(r?.message ?? r?.error ?? null); onChanged(); }} className="flex gap-2">
                      <input type="hidden" name="offerId" value={o.id} />
                      <button name="decision" value="accept" className="btn-primary flex-1 rounded-full py-2 text-sm" data-accept-offer>{t("Accept")}</button>
                      <button name="decision" value="decline" className="btn-secondary flex-1 rounded-full py-2 text-sm">{t("Decline")}</button>
                    </form>
                  </li>
                ))}
              </ul>
            ))}
            {offerMsg && <p role="status" className="text-sm text-brand-800">{t(offerMsg)}</p>}
            {onBack && <Link href={`/market/${d.id}`} className="inline-block text-sm font-medium text-brand-700 underline">{t("Open the full page to edit or mark as sold")}</Link>}
          </div>
        ) : (
          <div className="space-y-3">
            {d.myOffer && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-sage-soft/50 p-3 text-sm" data-my-offer>
                <span className="min-w-0 flex-1"><strong>{t("Your offer")}: ₪{d.myOffer.amount}</strong> · {t("waiting for the seller")}</span>
                <button type="button" onClick={() => sheet.current?.showModal()} className="font-medium text-brand-700 underline">{t("Change")}</button>
                <form action={async (fd) => { await withdrawOffer(null, fd); onChanged(); }}><input type="hidden" name="offerId" value={d.myOffer.id} /><button className="font-medium text-red-700 underline">{t("Withdraw")}</button></form>
              </div>
            )}
            {d.canAct && available ? (
              <div className="hidden space-y-2 md:block">
                {primaryOffer ? (
                  <button type="button" onClick={() => sheet.current?.showModal()} className="btn-primary w-full rounded-full py-3.5 text-base" data-make-offer><HandCoins className="size-5" aria-hidden="true" />{t("Make an Offer")}</button>
                ) : messageForm("btn-primary w-full rounded-full py-3.5 text-base", t("Message Seller"))}
                {primaryOffer && messageForm("btn-secondary w-full rounded-full py-3", t("Message Seller"))}
                <button type="button" onClick={toggleSave} aria-pressed={saved} className="btn-secondary w-full rounded-full py-3" data-save-item>{saved ? <BookmarkCheck className="size-[18px]" aria-hidden="true" /> : <Bookmark className="size-[18px]" aria-hidden="true" />}{saved ? t("Saved") : t("Save Item")}</button>
              </div>
            ) : d.canAct && !available ? (
              <p className="rounded-2xl bg-black/[0.04] p-3 text-sm text-ink-2">{t("This item is no longer available.")}</p>
            ) : null}
            {error && <p role="alert" className="text-sm text-red-700">{t(error)}</p>}
            <div className="flex flex-wrap items-center gap-3"><ReportButton targetType="listing" targetId={d.id} label={t("Report Listing")} />{d.staff && <AdminControls kind="listing" id={d.id} title={d.title} detail={d.description} {...d.staff} next="/market" />}</div>
          </div>
        )}
      </div>

      {/* A phone gets the main action in a bar that stays at the bottom while the page scrolls. */}
      {!d.mine && d.canAct && available && (
        <div className="sticky bottom-0 z-10 -mx-4 flex gap-2 border-t border-black/10 bg-cream/95 px-4 py-3 backdrop-blur max-md:-mb-4 md:hidden" data-mobile-actions>
          <button type="button" onClick={toggleSave} aria-pressed={saved} aria-label={saved ? t("Saved") : t("Save Item")} className="btn-secondary size-12 shrink-0 rounded-full p-0" data-save-item-mobile>{saved ? <BookmarkCheck className="size-5" aria-hidden="true" /> : <Bookmark className="size-5" aria-hidden="true" />}</button>
          {primaryOffer ? (
            <>
              <div className="flex-1">{messageForm("btn-secondary h-12 w-full rounded-full", t("Message Seller"), false)}</div>
              <button type="button" onClick={() => sheet.current?.showModal()} className="btn-primary h-12 flex-[1.3] rounded-full" data-make-offer-mobile><HandCoins className="size-[18px]" aria-hidden="true" />{t("Make an Offer")}</button>
            </>
          ) : <div className="flex-1">{messageForm("btn-primary h-12 w-full rounded-full", t("Message Seller"))}</div>}
        </div>
      )}

      {d.canOffer && <OfferSheet d={d} locale={locale} sheet={sheet} onChanged={onChanged} />}
    </div>
  );
}
