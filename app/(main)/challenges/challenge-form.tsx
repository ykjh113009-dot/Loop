"use client";

import { useActionState, useState, useTransition } from "react";
import { saveChallenge } from "@/app/actions/challenges";
import { PhotoField } from "@/components/photo-field";
import { CATEGORIES, KINDS, PROOF } from "@/lib/challenges";
import { makeT, type Locale } from "@/lib/i18n";

export type ChallengeDraft = {
  id?: string;
  title: string; description: string; instructions: string; rules: string; emoji: string;
  category: string; kind: string; starts: string; ends: string;
  reward_mode: string; points: number; prizes: number[];
  audience: string; audience_grade: number | null; audience_section: string | null;
  proof_kinds: string[]; questions: string[]; max_participants: number | null;
  attempts: number; rewards: number; cover_path: string | null; review_note?: string | null;
};

const REPEAT = [
  ["1:1", "One time only"],
  ["3:3", "Up to 3 times, every time is rewarded"],
  ["3:1", "Up to 3 tries, only the first success is rewarded"],
  ["5:5", "Up to 5 times, every time is rewarded"],
  ["10:10", "Up to 10 times, every time is rewarded"],
  ["10:3", "Up to 10 tries, the first 3 successes are rewarded"],
] as const;

export function ChallengeForm({ draft, schoolId, userId, locale }: { draft: ChallengeDraft; schoolId: string; userId: string; locale: Locale }) {
  const t = makeT(locale);
  const [state, action, pending] = useActionState(saveChallenge, null);
  const [, start] = useTransition();
  const [mode, setMode] = useState(draft.reward_mode);
  const [audience, setAudience] = useState(draft.audience);
  const [proof, setProof] = useState<string[]>(draft.proof_kinds);
  const repeatValue = `${draft.attempts}:${draft.rewards}`;

  return (
    // Submitted by hand so a mistake does not wipe what the student typed.
    <form onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter); start(() => action(fd)); }} className="space-y-4">
      {draft.id && <input type="hidden" name="id" value={draft.id} />}
      {draft.cover_path && <input type="hidden" name="keep_cover" value={draft.cover_path} />}
      {draft.review_note && (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><strong>{t("Feedback from the reviewer")}:</strong> {draft.review_note}</p>
      )}

      <section className="card space-y-3 p-4">
        <h2 className="section-title">{t("The idea")}</h2>
        <div className="grid grid-cols-[5rem_1fr] gap-3">
          <label className="block"><span className="label">{t("Icon")}</span><input name="emoji" defaultValue={draft.emoji} maxLength={4} className="input text-center text-xl" aria-label={t("Icon")} /></label>
          <label className="block"><span className="label">{t("Title")}</span><input name="title" required minLength={3} maxLength={100} defaultValue={draft.title} className="input" placeholder={t("e.g. School photo hunt")} /></label>
        </div>
        <label className="block"><span className="label">{t("What is it about?")}</span><textarea name="description" rows={3} maxLength={1000} defaultValue={draft.description} className="input resize-none" placeholder={t("Explain the challenge in a few sentences.")} /></label>
        <label className="block"><span className="label">{t("Step-by-step instructions")}</span><textarea name="instructions" rows={4} maxLength={2000} defaultValue={draft.instructions} className="input resize-none" placeholder={t("What should students do, and what counts as finished?")} /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="label">{t("Category")}</span>
            <select name="category" defaultValue={draft.category} className="input">{CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.emoji} {t(c.label)}</option>)}</select>
          </label>
          <fieldset><legend className="label">{t("Type")}</legend>
            {KINDS.map((k) => (
              <label key={k.id} className="flex items-start gap-2 py-1 text-sm"><input type="radio" name="kind" value={k.id} defaultChecked={draft.kind === k.id} className="mt-0.5 size-5 accent-brand-700" /><span><strong>{t(k.label)}</strong> <span className="text-black/50">{t(k.text)}</span></span></label>
            ))}
          </fieldset>
        </div>
        <PhotoField schoolId={schoolId} userId={userId} label={draft.cover_path ? t("Change cover photo") : t("Add a cover photo")} />
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="section-title">{t("When and who")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="label">{t("Starts")}</span><input type="datetime-local" name="starts" required defaultValue={draft.starts} className="input" /></label>
          <label className="block"><span className="label">{t("Deadline")}</span><input type="datetime-local" name="ends" required defaultValue={draft.ends} className="input" /></label>
        </div>
        <label className="block"><span className="label">{t("Who can take part?")}</span>
          <select name="audience" value={audience} onChange={(e) => setAudience(e.target.value)} className="input">
            <option value="school">{t("The whole school")}</option>
            <option value="grade">{t("One grade")}</option>
            <option value="class">{t("One class")}</option>
          </select>
        </label>
        {audience !== "school" && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="label">{t("Grade")}</span>
              <select name="audience_grade" defaultValue={draft.audience_grade ?? ""} required className="input">
                <option value="" disabled>–</option>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </label>
            {audience === "class" && <label className="block"><span className="label">{t("Class letter")}</span><input name="audience_section" required maxLength={2} defaultValue={draft.audience_section ?? ""} className="input uppercase" placeholder="A" /></label>}
          </div>
        )}
        <label className="block"><span className="label">{t("Maximum number of students (optional)")}</span><input type="number" name="max_participants" min={1} max={5000} defaultValue={draft.max_participants ?? ""} className="input" /></label>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="section-title">{t("Proof students send")}</h2>
        <div className="grid grid-cols-2 gap-2">
          {PROOF.map((p) => (
            <label key={p.id} className="flex items-center gap-2 rounded-xl border border-black/10 px-3 py-2 text-sm has-checked:border-brand-600 has-checked:bg-brand-50">
              <input type="checkbox" name="proof" value={p.id} checked={proof.includes(p.id)} onChange={(e) => setProof((cur) => e.target.checked ? [...cur, p.id] : cur.filter((x) => x !== p.id))} className="size-5 accent-brand-700" />
              {p.emoji} {t(p.label)}
            </label>
          ))}
        </div>
        {proof.includes("answers") && (
          <label className="block"><span className="label">{t("Questions (one per line, up to 10)")}</span><textarea name="questions" rows={4} defaultValue={draft.questions.join("\n")} className="input resize-none" /></label>
        )}
        <label className="block"><span className="label">{t("Rules for taking part")}</span><textarea name="rules" rows={3} maxLength={1000} defaultValue={draft.rules} className="input resize-none" placeholder={t("e.g. Stay in the school yard. Do not photograph other students.")} /></label>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="section-title">{t("Points")}</h2>
        <fieldset className="space-y-1">
          <label className="flex items-start gap-2 text-sm"><input type="radio" name="reward_mode" value="fixed" checked={mode === "fixed"} onChange={() => setMode("fixed")} className="mt-0.5 size-5 accent-brand-700" /><span><strong>{t("Same points for everyone who completes it")}</strong></span></label>
          <label className="flex items-start gap-2 text-sm"><input type="radio" name="reward_mode" value="ranked" checked={mode === "ranked"} onChange={() => setMode("ranked")} className="mt-0.5 size-5 accent-brand-700" /><span><strong>{t("A competition: points depend on the place")}</strong></span></label>
        </fieldset>
        {mode === "fixed" ? (
          <label className="block"><span className="label">{t("Points for each approved entry (5 to 100)")}</span><input type="number" name="points" min={5} max={100} defaultValue={draft.points || 20} className="input" /></label>
        ) : (
          <>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="block"><span className="label">{n === 1 ? "🥇" : n === 2 ? "🥈" : n === 3 ? "🥉" : `#${n}`}</span><input type="number" name={`prize${n}`} min={1} max={300} defaultValue={draft.prizes[n - 1] ?? ""} className="input px-2" aria-label={`${t("Points for place")} ${n}`} /></label>
              ))}
            </div>
            <p className="text-xs text-black/50">{t("Leave a place empty if there is no prize for it. Prizes above 100 points need an admin.")}</p>
            <label className="block"><span className="label">{t("Points just for taking part (optional)")}</span><input type="number" name="participation_points" min={0} max={100} defaultValue={draft.points} className="input" /></label>
          </>
        )}
        <label className="block"><span className="label">{t("Can students do it more than once?")}</span>
          <select name="repeat" defaultValue={repeatValue} className="input">
            {REPEAT.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
          </select>
        </label>
      </section>

      <label className="card flex items-start gap-3 p-4 text-sm">
        <input type="checkbox" name="safe" defaultChecked={false} className="mt-0.5 size-5 shrink-0 accent-brand-700" />
        <span>{t("I confirm this challenge is safe: it does not ask anyone to do something dangerous, enter a restricted area, or break school rules, and it respects other students' privacy.")}</span>
      </label>

      {state?.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button name="intent" value="draft" disabled={pending} className="btn-secondary flex-1">{pending ? "…" : t("Save as draft")}</button>
        <button name="intent" value="send" disabled={pending} className="btn-primary flex-1">{pending ? "…" : t("Send for review")}</button>
      </div>
      <p className="text-center text-xs text-black/50">{t("The Student Council or an admin checks every challenge before students can see it.")}</p>
    </form>
  );
}
