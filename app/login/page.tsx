import { Suspense } from "react";
import Link from "next/link";
import { GoogleButton } from "./google-button";
import { demoSignIn } from "@/app/actions/auth";
import { DEMO_ACCOUNTS, isDemoMode } from "@/lib/demo";
import { Avatar } from "@/components/avatar";

export const metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  "school-email": "Please use your school email address (it ends with @pioneers.edu.ps).",
  roster: "Your school hasn't added your email yet. Please ask your school admin.",
  demo: "Demo sign-in didn't work. Is the demo data loaded?",
  failed: "Sign-in didn't finish. Please try again.",
};

async function ErrorMessage({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? (ERRORS[error] ?? ERRORS.failed) : null;
  if (!message) return null;
  return <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>;
}

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-5 py-10">
      <div className="text-center">
        <h1>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/loop-wordmark.png" alt="Loop" width={191} height={80} className="mx-auto h-20 w-auto" />
        </h1>
        <p className="mt-1 text-black/60">Clubs, events and friends — just for your school.</p>
      </div>

      <div className="card space-y-4 p-5">
        <Suspense>
          <ErrorMessage searchParams={props.searchParams} />
        </Suspense>
        <GoogleButton />
        <p className="text-center text-xs text-black/50">
          Only students with a school email can join. By signing in you agree to the{" "}
          <Link href="/rules" className="underline">community rules</Link> and{" "}
          <Link href="/privacy" className="underline">privacy notice</Link>.
        </p>
      </div>

      {isDemoMode() && (
        <div className="card space-y-3 border-amber-300 bg-amber-50 p-5">
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
    </main>
  );
}
