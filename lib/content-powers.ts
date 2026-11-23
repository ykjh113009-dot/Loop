import type { Me } from "@/lib/auth";

// What the signed-in person may do to one piece of content. Only used to decide which buttons to show: the database checks
// every action again (moderators: posts, comments, listings, group-chat messages; admins: everything; only a platform owner
// deletes without hiding first; only a Super Admin deletes at all).
export type ContentKind = "post" | "comment" | "message" | "listing" | "club" | "group" | "event" | "poll" | "resource" | "challenge" | "volunteering" | "announcement" | "council";
// Kinds with no hidden state: they are edited, closed or deleted (a Super Admin, with a reason), never hidden.
const NO_HIDE: ContentKind[] = ["poll", "announcement", "council"];
const STAFF_KINDS: ContentKind[] = ["post", "comment", "message", "listing"];

export function contentPowers(me: Me, kind: ContentKind) {
  return {
    canHide: NO_HIDE.includes(kind) ? false : STAFF_KINDS.includes(kind) ? me.isStaff : me.isAdmin,
    canEdit: me.isAdmin && kind !== "message" && kind !== "resource",
    // A platform owner deletes anything directly; a Super Admin deletes kinds that cannot be hidden. The rest is hidden first.
    canDelete: me.isPlatformOwner || (me.isSuperAdmin && NO_HIDE.includes(kind)),
  };
}
