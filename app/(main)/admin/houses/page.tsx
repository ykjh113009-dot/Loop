import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ACCENTS } from "@/lib/accent";
import { addHouse, addHouseClass, createCompetition, createDefaultHouses, deleteHouse, removeHouseClass } from "@/app/actions/community";
import { ActionForm } from "@/components/action-form";
import { AdminNav } from "@/components/admin-nav";
import { PageHeader } from "@/components/page-header";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";
import { formatDate } from "@/lib/time";

export const metadata = { title: "Houses" };

async function Houses() {
  const me = await requireMe();
  const supabase = await createClient();
  const { data: roles } = await supabase.from("leadership_roles").select("kind").eq("profile_id", me.id).eq("kind", "school_staff");
  const staff = (roles ?? []).length > 0;
  if (!me.isAdmin && !staff) return <p className="card p-4 text-sm text-black/60">Only admins and school staff can open this page.</p>;
  const [{ data: houses }, { data: classes }, { data: comps }] = await Promise.all([
    supabase.from("houses").select("id, name, emoji, color, motto").order("sort").order("name"),
    supabase.from("house_classes").select("house_id, grade, section").order("grade", { ascending: false }).order("section"),
    supabase.from("competitions").select("id, name, kind, starts_at, ends_at").order("ends_at", { ascending: false }).limit(20),
  ]);
  const stamp = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const now = new Date();

  return (
    <div className="space-y-4">
      {me.isAdmin && (
        <>
          <section className="card space-y-3 p-4">
            <h2 className="font-semibold">Houses</h2>
            <p className="text-sm text-black/55">A student&apos;s class (grade and letter, like 11A) decides their house. Their points add up for it. Students cannot change their own class.</p>
            {(houses ?? []).length === 0 && (
              <ActionForm action={createDefaultHouses} className="flex flex-wrap items-end gap-2">
                <label className="text-sm"><span className="label">Letter houses (A, B, C…)</span><input name="count" type="number" min={2} max={6} defaultValue={4} className="input w-24" /></label>
                <SubmitButton className="btn-primary" pendingText="…">Create houses</SubmitButton>
                <span className="text-xs text-black/50">House A gets 12A, 11A, 10A and 9A, and so on.</span>
              </ActionForm>
            )}
            <ul className="space-y-2">
              {(houses ?? []).map((h) => (
                <li key={h.id} className="rounded-xl border border-black/10 p-3" data-house={h.name}>
                  <div className="flex flex-wrap items-center gap-2"><span className="size-3 rounded-full" style={{ background: ACCENTS[h.color]?.ring }} /><strong>{h.emoji} {h.name}</strong>{h.motto && <span className="text-xs text-black/50">{h.motto}</span>}
                    <ActionForm action={deleteHouse} className="ms-auto"><input type="hidden" name="houseId" value={h.id} /><SubmitButton className="btn-ghost px-2 py-0.5 text-xs text-red-700" pendingText="…">Delete</SubmitButton></ActionForm></div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(classes ?? []).filter((c) => c.house_id === h.id).map((c) => (
                      <ActionForm key={`${c.grade}${c.section}`} action={removeHouseClass}>
                        <input type="hidden" name="grade" value={c.grade} /><input type="hidden" name="section" value={c.section} />
                        <button className="chip hover:bg-red-50" title="Remove this class from the house" aria-label={`Remove ${c.grade}${c.section}`}>{c.grade}{c.section} ✕</button>
                      </ActionForm>
                    ))}
                    <ActionForm action={addHouseClass} className="flex gap-1">
                      <input type="hidden" name="houseId" value={h.id} />
                      <input name="class" maxLength={3} placeholder="11C" aria-label={`Add a class to ${h.name}`} className="input w-20 py-1 text-sm uppercase" />
                      <SubmitButton className="btn-secondary px-2.5 py-1 text-xs" pendingText="…">Add</SubmitButton>
                    </ActionForm>
                  </div>
                </li>
              ))}
            </ul>
            <ActionForm action={addHouse} className="flex flex-wrap gap-2 border-t border-black/5 pt-3">
              <input name="emoji" defaultValue="🏠" maxLength={4} aria-label="Icon" className="input w-16 text-center" />
              <input name="name" required minLength={2} maxLength={40} placeholder="New house name" aria-label="House name" className="input min-w-40 flex-1" />
              <select name="color" className="input w-auto" aria-label="Colour">{Object.entries(ACCENTS).map(([k, a]) => <option key={k} value={k}>{a.name}</option>)}</select>
              <SubmitButton className="btn-primary" pendingText="…">Add house</SubmitButton>
            </ActionForm>
          </section>
        </>
      )}

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">Competitions</h2>
        <ActionForm action={createCompetition} className="space-y-2">
          <input name="name" required minLength={3} maxLength={80} placeholder="e.g. Science week" aria-label="Competition name" className="input" />
          <textarea name="description" maxLength={1000} rows={2} placeholder="What is it about?" aria-label="Description" className="input resize-none" />
          <div className="grid gap-2 sm:grid-cols-4">
            <select name="kind" className="input" aria-label="Type"><option value="team">Student teams</option><option value="house">Houses</option></select>
            <input name="starts" type="datetime-local" required defaultValue={stamp(now)} aria-label="Starts" className="input" />
            <input name="ends" type="datetime-local" required defaultValue={stamp(new Date(now.getTime() + 7 * 86400000))} aria-label="Ends" className="input" />
            <input name="team_size" type="number" min={2} max={20} defaultValue={5} aria-label="Team size" className="input" />
          </div>
          <SubmitButton className="btn-primary w-full">Create competition</SubmitButton>
        </ActionForm>
        <ul className="divide-y divide-black/5 text-sm">
          {(comps ?? []).map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 py-2"><Link href={`/competitions/${c.id}`} className="font-medium hover:underline">🏁 {c.name}</Link><span className="text-xs text-black/50">{c.kind === "house" ? "Houses" : "Teams"} · until {formatDate(c.ends_at)}</span></li>
          ))}
        </ul>
        <p className="text-xs text-black/50">Open a competition to give points to a team or a house.</p>
      </section>
    </div>
  );
}

export default function AdminHousesPage() {
  return (
    <>
      <PageHeader title="Admin" />
      <AdminNav current="/admin/houses" />
      <Suspense fallback={<PageSkeleton />}>
        <Houses />
      </Suspense>
    </>
  );
}
