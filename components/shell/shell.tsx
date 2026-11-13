import { getBadges, getMe } from "@/lib/auth";
import { personLabel } from "@/lib/people";
import { ShellFrame } from "@/components/shell/shell-frame";
import { getLocale } from "@/lib/i18n-server";

// Looks up who is signed in, then draws the sidebar, top bar and tabs around them.
export async function Shell() {
  const [me, locale] = await Promise.all([getMe(), getLocale()]);
  if (!me) return <ShellFrame user={null} initial={{ notifications: 0, messages: 0, moderation: 0 }} locale={locale} />;
  const badges = await getBadges();
  return (
    <ShellFrame
      user={{
        id: me.id,
        name: me.full_name,
        avatar: me.avatar,
        label: personLabel(me) || "Student",
        isStaff: me.isStaff,
        // Admins who still need the second sign-in step see the link and are sent to do it.
        isAdmin: me.isAdmin || me.needsMfa,
        isCounselor: me.isCounselor,
      }}
      initial={badges}
      locale={locale}
    />
  );
}
