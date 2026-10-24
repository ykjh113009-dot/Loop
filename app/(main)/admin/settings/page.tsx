import { Suspense } from "react";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addBlockedWord, addToRoster, removeBlockedWord, removeFromRoster, updateSchool } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { AdminNav } from "@/components/admin-nav";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Settings" };

async function Settings() {
  const me = await requireMe("admin");
  const supabase = await createClient();
  const [{ data: school }, { data: roster, count: rosterCount }, { data: words }] = await Promise.all([
    supabase.from("schools").select("name, email_domain, grades, roster_required").eq("id", me.school_id).single(),
    supabase.from("roster").select("email, grade", { count: "exact" }).order("email").limit(200),
    supabase.from("blocked_words").select("id, word, school_id").order("word"),
  ]);
  const ours = (words ?? []).filter((w) => w.school_id);
  const shared = (words ?? []).filter((w) => !w.school_id);

  return (
    <div className="space-y-4">
      <section className="card p-4">
        <h2 className="font-semibold">School</h2>
        <ActionForm action={updateSchool} className="mt-3 space-y-3">
          <label className="block">
            <span className="label">Name</span>
            <input name="name" defaultValue={school?.name} maxLength={100} className="input" />
          </label>
          <label className="block">
            <span className="label">Grades (comma separated)</span>
            <input name="grades" defaultValue={school?.grades.join(", ")} className="input" />
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="roster_required" defaultChecked={school?.roster_required} className="mt-0.5 size-5 accent-brand-700" />
            <span>
              <strong>Only allow emails on the list below.</strong> When off, anyone with an @{school?.email_domain} email can join
              (including staff). Turn it on once you&apos;ve added all students.
            </span>
          </label>
          <SubmitButton className="btn-primary w-full">Save</SubmitButton>
        </ActionForm>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">Student email list <span className="font-normal text-black/45">({rosterCount ?? 0})</span></h2>
        <p className="mt-1 text-sm text-black/55">Paste student emails (one per line or separated by commas). Their grade is set automatically when they join.</p>
        <ActionForm action={addToRoster} className="mt-3 space-y-2">
          <textarea name="emails" rows={4} required placeholder={`ahmad.k@${school?.email_domain}\nsara.m@${school?.email_domain}`} className="input resize-none font-mono text-sm" />
          <div className="flex gap-2">
            <select name="grade" className="input" aria-label="Grade">
              <option value="">No grade (student picks)</option>
              {me.school.grades.map((g) => <option key={g} value={g}>Grade {g}</option>)}
            </select>
            <SubmitButton className="btn-primary shrink-0">Add</SubmitButton>
          </div>
        </ActionForm>
        {roster && roster.length > 0 && (
          <ul className="mt-3 max-h-64 divide-y divide-black/5 overflow-y-auto rounded-xl border border-black/5 text-sm">
            {roster.map((r) => (
              <li key={r.email} className="flex items-center gap-2 px-3 py-1.5">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{r.email}</span>
                <span className="text-xs text-black/45">{r.grade ? `G${r.grade}` : ""}</span>
                <ActionForm action={removeFromRoster}>
                  <input type="hidden" name="email" value={r.email} />
                  <SubmitButton className="text-xs text-black/40 hover:text-red-600" pendingText="…">Remove</SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card p-4">
        <h2 className="font-semibold">Blocked words</h2>
        <p className="mt-1 text-sm text-black/55">
          Posts and messages with these words are hidden until a moderator checks them. Matching ignores capital letters,
          Arabic vowel marks and stretched letters (&quot;heyyyy&quot;). {shared.length} words are built in.
        </p>
        <ActionForm action={addBlockedWord} className="mt-3 flex gap-2">
          <input name="word" required minLength={2} maxLength={60} placeholder="Add a word or phrase" className="input" />
          <SubmitButton className="btn-primary shrink-0">Add</SubmitButton>
        </ActionForm>
        {ours.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {ours.map((w) => (
              <ActionForm key={w.id} action={removeBlockedWord}>
                <input type="hidden" name="id" value={w.id} />
                <button className="chip hover:bg-red-50 hover:text-red-700" title="Remove">{w.word} ✕</button>
              </ActionForm>
            ))}
          </div>
        )}
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-black/50">Show built-in words</summary>
          <p className="mt-2 text-xs leading-relaxed text-black/50" dir="auto">{shared.map((w) => w.word).join(" · ")}</p>
        </details>
      </section>
    </div>
  );
}

export default function AdminSettingsPage() {
  return (
    <>
      <PageHeader title="Settings" />
      <AdminNav current="/admin/settings" />
      <Suspense fallback={<PageSkeleton />}>
        <Settings />
      </Suspense>
    </>
  );
}
