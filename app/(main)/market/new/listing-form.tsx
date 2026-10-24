"use client";

import { useActionState, useState } from "react";
import { createListing } from "@/app/actions/market";
import { CATEGORIES, CONDITIONS } from "@/lib/market";
import { FormMessage } from "@/components/form-message";
import { PhotoField } from "@/components/photo-field";
import { MarketSafetyNote } from "@/components/safety-note";
import { SubmitButton } from "@/components/submit-button";

export function ListingForm({ schoolId, userId }: { schoolId: string; userId: string }) {
  const [state, action] = useActionState(createListing, null);
  const [kind, setKind] = useState("sell");
  return (
    <form action={action} className="card space-y-4 p-4">
      <fieldset>
        <legend className="label">I want to</legend>
        <div className="grid grid-cols-3 gap-2">
          {[["sell", "💰 Sell"], ["swap", "🔄 Swap"], ["free", "🎁 Give away"]].map(([value, label]) => (
            <label key={value} className="cursor-pointer">
              <input type="radio" name="kind" value={value} checked={kind === value} onChange={() => setKind(value)} className="peer sr-only" />
              <span className="block rounded-xl border border-black/10 bg-white py-2.5 text-center text-sm font-medium peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:text-brand-800">{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <input name="title" required minLength={3} maxLength={80} placeholder="What is it? e.g. Grade 11 math book" className="input" />
      <textarea name="description" rows={3} maxLength={800} placeholder={kind === "swap" ? "What would you like in exchange?" : "Describe it: size, edition, anything missing…"} className="input resize-none" />
      <div className="grid grid-cols-2 gap-2">
        <select name="category" className="input" aria-label="Category" defaultValue="books">
          {Object.entries(CATEGORIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select name="condition" className="input" aria-label="Condition" defaultValue="good">
          {Object.entries(CONDITIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
      </div>
      {kind === "sell" && (
        <label className="block text-sm">
          <span className="label">Price (₪)</span>
          <input name="price" type="number" required min={0} max={5000} step={1} className="input" placeholder="e.g. 20" />
        </label>
      )}
      <PhotoField schoolId={schoolId} userId={userId} />
      <MarketSafetyNote />
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Posting…">Post item</SubmitButton>
    </form>
  );
}
