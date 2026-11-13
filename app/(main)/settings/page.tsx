import { Suspense } from "react";
import Link from "next/link";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { LOCALES } from "@/lib/i18n";
import { deactivateAccount, deleteAccount, saveSettings, unblock } from "@/app/actions/social";
import { ActionForm } from "@/components/action-form";
import { Avatar } from "@/components/avatar";
import { PageHeader } from "@/components/page-header";
import { PushToggle } from "@/components/push-toggle";
import { SubmitButton } from "@/components/submit-button";
import { PageSkeleton } from "@/components/skeleton";

export const metadata = { title: "Settings" };

async function Settings() {
  const me = await requireMe();
  const supabase = await createClient();
  const { t, locale } = await getT();
  const [{ data: saved }, { data: blocks }, { data: contact }] = await Promise.all([
    supabase.from("profile_settings").select("*").eq("profile_id", me.id).maybeSingle(),
    supabase.from("blocks").select("blocked:profiles!blocks_blocked_id_fkey(id, full_name, avatar)").eq("blocker_id", me.id),
    supabase.from("private_profiles").select("email").eq("id", me.id).maybeSingle(),
  ]);
  const s = saved ?? { who_can_message: "everyone", notifications_enabled: true, reduce_motion: false, large_text: false };
  const check = "mt-0.5 size-5 accent-brand-700";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <PageHeader title={t("Settings")} />

      <section className="card flex items-center gap-3 p-4">
        <Avatar avatar={me.avatar} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{me.full_name}</p>
          <p className="truncate text-sm text-black/55" dir="ltr">{contact?.email}</p>
        </div>
        <Link href="/profile/edit" className="btn-secondary px-3 py-2">{t("Edit profile")}</Link>
      </section>

      <ActionForm action={saveSettings} className="space-y-4">
        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">{t("Language")}</h2>
          <select name="locale" defaultValue={locale} className="input" aria-label={t("Language")}>
            {LOCALES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
          </select>
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">{t("Privacy")}</h2>
          <label className="block">
            <span className="label">{t("Who can send you private messages")}</span>
            <select name="who_can_message" defaultValue={s.who_can_message} className="input">
              <option value="everyone">{t("Any student at my school")}</option>
              <option value="friends">{t("Friends only (others send a request first)")}</option>
              <option value="nobody">{t("Nobody new")}</option>
            </select>
          </label>
          <p className="text-xs text-black/50">{t("Every student at your school can see your profile. Your email is only visible to you and admins.")}</p>
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">{t("Notifications")}</h2>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="notifications_enabled" defaultChecked={s.notifications_enabled} className={check} />
            <span>
              <strong>{t("Loop notifications")}</strong>
              <span className="block text-black/55">{t("When this is off, Loop sends you nothing and the bell stays quiet. Your activity is still listed when you open Loop.")}</span>
            </span>
          </label>
        </section>

        <section className="card space-y-3 p-4">
          <h2 className="font-semibold">{t("Accessibility")}</h2>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="large_text" defaultChecked={s.large_text} className={check} />
            <span><strong>{t("Larger text")}</strong></span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="reduce_motion" defaultChecked={s.reduce_motion} className={check} />
            <span><strong>{t("Reduce motion")}</strong><span className="block text-black/55">{t("Turns off animations.")}</span></span>
          </label>
        </section>

        <SubmitButton className="btn-primary w-full">{t("Save settings")}</SubmitButton>
      </ActionForm>

      <PushToggle />

      <section className="card space-y-2 p-4">
        <h2 className="font-semibold">{t("Blocked students")}</h2>
        {(blocks ?? []).length === 0 && <p className="text-sm text-black/55">{t("You have not blocked anyone.")}</p>}
        {(blocks ?? []).map((b) => b.blocked && (
          <form key={b.blocked.id} action={unblock} className="flex items-center gap-3">
            <Avatar avatar={b.blocked.avatar} size="sm" />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{b.blocked.full_name}</span>
            <input type="hidden" name="profileId" value={b.blocked.id} />
            <SubmitButton className="btn-secondary px-3 py-1.5" pendingText="…">{t("Unblock")}</SubmitButton>
          </form>
        ))}
      </section>

      <section className="card space-y-2 p-4">
        <h2 className="font-semibold">{t("Login and security")}</h2>
        <p className="text-sm text-black/55">{t("Two-step sign-in and recent activity on your account.")}</p>
        <Link href="/security" className="btn-secondary">{t("Open security")}</Link>
      </section>

      <section className="card space-y-3 p-4">
        <h2 className="font-semibold">{t("Deactivate account")}</h2>
        <p className="text-sm text-black/55">{t("Hides your profile and posts until you come back. Nothing is deleted.")}</p>
        <ActionForm action={deactivateAccount} className="space-y-2">
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" name="sure" className={check} />
            <span>{t("Yes, deactivate my account for now")}</span>
          </label>
          <SubmitButton className="btn-secondary">{t("Deactivate")}</SubmitButton>
        </ActionForm>
      </section>

      <section className="card space-y-3 border-red-200 p-4">
        <h2 className="font-semibold text-red-800">{t("Delete account")}</h2>
        <p className="text-sm text-black/55">{t("Deletes your profile, posts, comments, messages and points for good. This cannot be undone and needs no admin approval.")}</p>
        <ActionForm action={deleteAccount} className="flex flex-wrap gap-2">
          <input name="confirm" autoComplete="off" placeholder={t("Type DELETE to confirm")} aria-label={t("Type DELETE to confirm")} className="input min-w-40 flex-1" dir="ltr" />
          <SubmitButton className="btn-danger" pendingText="…">{t("Delete my account")}</SubmitButton>
        </ActionForm>
      </section>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Settings />
    </Suspense>
  );
}
