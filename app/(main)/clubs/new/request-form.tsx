"use client";

import { useActionState, useState } from "react";
import { requestClub } from "@/app/actions/clubs";
import { SubmitButton } from "@/components/submit-button";
import { FormMessage } from "@/components/form-message";

const EMOJIS = ["⭐", "⚽", "🏀", "🤖", "💻", "🎨", "🎵", "🎭", "📚", "🎤", "📷", "🌱", "♟️", "🍳", "🎮", "🤝", "💃", "🔬", "✍️", "🧵"];

export function RequestClubForm() {
  const [state, action] = useActionState(requestClub, null);
  const [emoji, setEmoji] = useState("⭐");
  return (
    <form action={action} className="card space-y-4 p-4">
      <div>
        <label htmlFor="name" className="label">Club name</label>
        <input id="name" name="name" required minLength={3} maxLength={60} className="input" placeholder="e.g. Photography Club" />
      </div>
      <fieldset>
        <legend className="label">Pick an icon</legend>
        <input type="hidden" name="emoji" value={emoji} />
        <div className="flex flex-wrap gap-1.5">
          {EMOJIS.map((e) => (
            <button
              type="button"
              key={e}
              onClick={() => setEmoji(e)}
              aria-pressed={emoji === e}
              className={`size-10 rounded-xl text-xl ${emoji === e ? "bg-brand-100 ring-2 ring-brand-600" : "bg-black/5"}`}
            >
              {e}
            </button>
          ))}
        </div>
      </fieldset>
      <div>
        <label htmlFor="description" className="label">What will the club do?</label>
        <textarea id="description" name="description" required minLength={10} maxLength={500} rows={4} className="input resize-none" placeholder="When do you meet? Who is it for?" />
      </div>
      <p className="text-xs text-black/50">A moderator will review your request. If it&apos;s approved, you become the club leader.</p>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full" pendingText="Sending…">Send request</SubmitButton>
    </form>
  );
}
