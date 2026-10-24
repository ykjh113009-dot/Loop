"use client";

import { useActionState } from "react";
import Link from "next/link";
import { completeOnboarding } from "@/app/actions/profile";
import { ProfileFields } from "@/components/profile-fields";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";

export function WelcomeForm({
  grades,
  fixedGrade,
  interests,
}: {
  grades: number[];
  fixedGrade: number | null;
  interests: { id: number; name: string; emoji: string }[];
}) {
  const [state, action] = useActionState(completeOnboarding, null);

  return (
    <form action={action} className="space-y-6">
      {fixedGrade ? (
        <p className="rounded-xl bg-brand-50 px-3 py-2 text-sm">
          Your school has you in <strong>grade {fixedGrade}</strong>.
        </p>
      ) : (
        <fieldset>
          <legend className="label">Which grade are you in?</legend>
          <div className="grid grid-cols-4 gap-2">
            {grades.map((g) => (
              <label key={g} className="cursor-pointer">
                <input type="radio" name="grade" value={g} className="peer sr-only" required />
                <span className="block rounded-xl border border-black/10 bg-white py-3 text-center font-semibold peer-checked:border-brand-600 peer-checked:bg-brand-50 peer-checked:text-brand-800">
                  {g}
                </span>
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-black/45">Only your school admin can change this later.</p>
        </fieldset>
      )}

      <ProfileFields interests={interests} />

      <label className="flex items-start gap-3 rounded-xl bg-black/[0.03] p-3 text-sm">
        <input type="checkbox" name="rules" className="mt-0.5 size-5 accent-brand-700" required />
        <span>
          I agree to the{" "}
          <Link href="/rules" target="_blank" className="font-semibold underline">community rules</Link>: be kind, use my
          real name, and report anything that makes me or others uncomfortable.
        </span>
      </label>

      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full py-3 text-base" pendingText="Setting up…">
        Let&apos;s go!
      </SubmitButton>
    </form>
  );
}
