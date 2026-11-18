import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getT } from "@/lib/i18n-server";
import { formatDate } from "@/lib/time";
import { myApplications, pickGate, type AppView } from "@/lib/applications";
import { acknowledgeApplication } from "@/app/actions/applications";
import { Confetti } from "@/components/confetti";

const NEXT_OK = ["/home", "/apply-admin"];

function Button({ app, to, children, kind = "primary" }: { app: AppView; to: string; children: React.ReactNode; kind?: "primary" | "secondary" }) {
  return (
    <form action={acknowledgeApplication}>
      <input type="hidden" name="kind" value={app.kind} />
      <input type="hidden" name="id" value={app.id} />
      <input type="hidden" name="to" value={to} />
      <button className={`${kind === "primary" ? "btn-primary" : "btn-secondary"} w-full justify-center px-8 py-3 text-base sm:w-auto`} data-continue>{children}</button>
    </form>
  );
}

async function Update({ searchParams }: { searchParams: Promise<{ id?: string; next?: string }> }) {
  const sp = await searchParams;
  const me = await getMe();
  if (!me) redirect("/login");
  if (me.deactivated_at) redirect("/removed");
  const { t } = await getT();
  const supabase = await createClient();
  const apps = await myApplications(supabase, me.id);
  const app = (sp.id ? apps.find((a) => a.id === sp.id) : null) ?? (sp.id ? null : pickGate(apps));
  if (!app) redirect("/home");
  const next = NEXT_OK.includes(sp.next ?? "") ? sp.next! : "/home";
  const others = apps.filter((a) => a.id !== app.id && a.status !== "pending" && !a.seen).length;

  const head = (
    <div className="flex justify-center pt-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- static brand image */}
      <img src="/brand/loop-wordmark.png" alt="Loop" className="h-9 w-auto" />
    </div>
  );

  if (app.status === "approved") {
    return (
      <>
        <Confetti />
        <div className="relative space-y-5 text-center" data-decision="approved">
          {head}
          <div className="card space-y-3 rounded-3xl p-6">
            <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{t("Congratulations!")}</h1>
            <p className="text-black/70">{t("Your application has been approved. Welcome to the Loop team!")}</p>
            <div className="rounded-2xl bg-sage-soft/50 p-4 text-start">
              <p className="text-xs uppercase tracking-wide text-black/45">{t("Your role")}</p>
              <p className="text-lg font-semibold" data-role>{app.granted}</p>
              {app.granted && app.requested !== app.granted && <p className="mt-1 text-sm text-black/60">{t("You asked for {r}. The reviewer gave you this role.", { r: app.requested })}</p>}
              {app.responsibilities && <p className="mt-2 text-sm text-black/70">{app.responsibilities}</p>}
              {app.note && <p className="mt-2 text-sm text-black/60">“{app.note}”{app.reviewer ? ` — ${app.reviewer}` : ""}</p>}
            </div>
          </div>
          <div className="flex justify-center"><Button app={app} to={app.dashboard}>{t("Go to My Dashboard")} →</Button></div>
          {others > 0 && <p className="text-xs text-black/50">{t("You have {n} more application update(s) in your notifications.", { n: others })}</p>}
        </div>
      </>
    );
  }

  if (app.status === "rejected") {
    return (
      <div className="space-y-5 text-center" data-decision="rejected">
        {head}
        <div className="card space-y-3 rounded-3xl p-6">
          <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{t("Application update")}</h1>
          <p className="text-black/70">{t("Unfortunately, your application wasn't approved this time.")}</p>
          <p className="text-sm text-black/55">{t("You applied for {r}.", { r: app.requested })}</p>
          <div className="rounded-2xl bg-[#eef4f6] p-4 text-start">
            <p className="text-xs uppercase tracking-wide text-black/45">{t("Feedback from the reviewer")}</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-black/80" data-feedback>{app.note}</p>
          </div>
          <p className="text-sm text-black/60">{t("This isn't a no forever. You can improve your application and send it again.")}</p>
        </div>
        <div className="flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Button app={app} to={app.resubmit}>{t("Edit & Resubmit")}</Button>
          <Button app={app} to={next} kind="secondary">{t("Continue to Loop")}</Button>
        </div>
        {others > 0 && <p className="text-xs text-black/50">{t("You have {n} more application update(s) in your notifications.", { n: others })}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-5 text-center" data-decision="pending">
      {head}
      <div className="card space-y-3 rounded-3xl p-6">
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{t("We're reviewing your application")}</h1>
        <p className="text-black/70">{t("Your application is being reviewed. We'll let you know once a decision has been made.")}</p>
        <dl className="rounded-2xl bg-sage-soft/50 p-4 text-start text-sm">
          <div className="flex justify-between gap-3 py-1"><dt className="text-black/55">{t("Applied for")}</dt><dd className="font-semibold">{app.requested}</dd></div>
          <div className="flex justify-between gap-3 py-1"><dt className="text-black/55">{t("Submitted")}</dt><dd className="font-semibold">{formatDate(app.submittedAt)}</dd></div>
          <div className="flex justify-between gap-3 py-1"><dt className="text-black/55">{t("Status")}</dt><dd><span className="chip bg-amber-50 text-amber-900">{t("Waiting for review")}</span></dd></div>
        </dl>
      </div>
      <div className="flex justify-center"><Button app={app} to={next}>{t("Continue to Loop")} →</Button></div>
    </div>
  );
}

export default function ApplicationUpdatePage(props: PageProps<"/application-update">) {
  return (
    <main className="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center overflow-hidden bg-cream px-5 py-8" style={{ fontFamily: "var(--font-body), system-ui, sans-serif" }}>
      <Suspense fallback={<p className="text-center text-black/50">…</p>}>
        <Update searchParams={props.searchParams as Promise<{ id?: string; next?: string }>} />
      </Suspense>
      <Link href="/home" className="sr-only">Home</Link>
    </main>
  );
}
