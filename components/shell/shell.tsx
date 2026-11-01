import { getBadges, getMe } from "@/lib/auth";
import { personLabel } from "@/lib/people";
import { ShellFrame } from "@/components/shell/shell-frame";

// Looks up who is signed in, then draws the sidebar, top bar and tabs around them.
export async function Shell() {
  const me = await getMe();
  if (!me) return <ShellFrame user={null} initial={{ notifications: 0, messages: 0, moderation: 0 }} />;
  const badges = await getBadges();
  return (
    <ShellFrame
      user={{
        id: me.id,
        name: me.full_name,
        avatar: me.avatar,
        label: personLabel(me) || "Student",
        isStaff: me.isStaff,
        isAdmin: me.isAdmin,
        isCounselor: me.isCounselor,
      }}
      initial={badges}
    />
  );
}
