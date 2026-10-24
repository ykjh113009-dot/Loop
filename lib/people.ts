// How a person is described next to their name: "Grade 10", "Alumni · class of 2024"
// or "School counselor".
export function personLabel(p: { grade?: number | null; role?: string | null; alumni_year?: number | null } | null | undefined) {
  if (!p) return "";
  if (p.role === "counselor") return "School counselor";
  if (p.alumni_year) return `Alumni · class of ${p.alumni_year}`;
  return p.grade ? `Grade ${p.grade}` : "";
}
