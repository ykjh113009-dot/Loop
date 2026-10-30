import { Suspense } from "react";
import Link from "next/link";
import { GoogleButton } from "./google-button";
import { demoSignIn } from "@/app/actions/auth";
import { DEMO_ACCOUNTS, isDemoMode } from "@/lib/demo";
import { Avatar } from "@/components/avatar";
import { LoopRibbon } from "@/components/loop-ribbon";

export const metadata = { title: "Sign in" };

// Shown on the sign-in screen. The school domain is set per site, so other
// schools can use the same page later.
const SCHOOL_DOMAIN = process.env.NEXT_PUBLIC_GOOGLE_HOSTED_DOMAIN ?? "pioneers.edu.ps";

const WRONG_ACCOUNT = `We couldn't sign you in with that account. Choose your @${SCHOOL_DOMAIN} school account. If you did, ask your school admin to add your email.`;

const ERRORS: Record<string, string> = {
  "school-email": WRONG_ACCOUNT,
  roster: WRONG_ACCOUNT,
  demo: "Demo sign-in didn't work. Is the demo data loaded?",
  failed: "Sign-in didn't finish. Please try again.",
};

async function ErrorMessage({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? (ERRORS[error] ?? ERRORS.failed) : null;
  if (!message) return null;
  return (
    <p role="alert" className="lp-notice">
      {message}
    </p>
  );
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="lp">
      <aside className="lp-art" aria-hidden="true">
        <LoopRibbon />
      </aside>

      <div className="lp-main">
        <div className="lp-brand">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/loop-wordmark.png" alt="Loop" width={574} height={240} className="lp-wordmark" />
        </div>

        <div className="lp-center">
          <div>
            <h1 className="lp-headline">
              <span>Your school.</span>
              <span className="lp-accent">Your community.</span>
            </h1>
            <p className="lp-lede">Clubs, events, skills and friends, in one private place for students.</p>
          </div>

          <div className="lp-action">
            <Suspense>
              <ErrorMessage searchParams={props.searchParams} />
            </Suspense>
            <GoogleButton />
            <p className="lp-domain">
              Use your <span className="lp-pill">@{SCHOOL_DOMAIN}</span> school account. Personal Gmail and other
              accounts can&apos;t join.
            </p>

            {isDemoMode() && (
              <div className="lp-demo space-y-3">
                <div>
                  <p className="font-semibold">Demo mode</p>
                  <p className="text-sm text-black/60">Tap a fake account to look around. Turn this off on the real site.</p>
                </div>
                <div className="space-y-2">
                  {DEMO_ACCOUNTS.map((account) => (
                    <form key={account.email} action={demoSignIn}>
                      <input type="hidden" name="email" value={account.email} />
                      <button className="flex w-full items-center gap-3 rounded-xl bg-white px-3 py-2 text-left shadow-sm hover:bg-black/5">
                        <Avatar avatar={account.avatar} size="sm" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">{account.name}</span>
                          <span className="block text-xs text-black/55">{account.label}</span>
                        </span>
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lp-foot">
          <span className="lp-private">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            Private to your school
          </span>
          <Link href="/rules">Community rules</Link>
          <Link href="/privacy">Privacy</Link>
        </div>
      </div>
    </main>
  );
}
