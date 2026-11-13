// The four student leadership roles. A student can hold several at once.
export const LEADERSHIP_KINDS = [
  { kind: "class_rep", label: "Class representative" },
  { kind: "club_leader", label: "Club leader" },
  { kind: "council_member", label: "Student council member" },
  { kind: "school_staff", label: "School administration / staff" },
] as const;

export function leadershipLabel(kind: string, scope?: string | null, clubName?: string | null) {
  const base = LEADERSHIP_KINDS.find((k) => k.kind === kind)?.label ?? kind;
  const extra = kind === "club_leader" ? clubName : scope;
  return extra ? `${base} · ${extra}` : base;
}
