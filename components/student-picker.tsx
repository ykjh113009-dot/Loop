import { createClient } from "@/lib/supabase/server";

// A dropdown of current students at the school (for admin forms).
export async function StudentPicker({ name = "profileId" }: { name?: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id, full_name, grade")
    .is("deactivated_at", null)
    .is("alumni_year", null)
    .neq("role", "counselor")
    .not("onboarded_at", "is", null)
    .order("full_name");
  return (
    <select name={name} required className="input" aria-label="Student" defaultValue="">
      <option value="" disabled>Choose a student…</option>
      {(data ?? []).map((s) => <option key={s.id} value={s.id}>{s.full_name} (grade {s.grade})</option>)}
    </select>
  );
}
