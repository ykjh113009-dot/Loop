import { Suspense } from "react";
import { signOut } from "@/app/actions/auth";
import { reactivateAccount } from "@/app/actions/social";
import { getMe } from "@/lib/auth";
import { Glyph } from "@/components/glyph";

export const metadata = { title: "Account paused" };

// Students who paused their own account can come back; accounts removed by
// an admin cannot.
async function Body() {
  const me = await getMe();
  const self = !!me?.self_deactivated;
  return (
    <>
      <div className="text-4xl">{self ? <Glyph e="⏸️" /> : <Glyph e="🔒" />}</div>
      <h1 className="text-xl font-bold">{self ? "Your account is deactivated" : "This account has been removed"}</h1>
      <p className="text-black/60">
        {self
          ? "Nobody can see your profile or posts while it is deactivated. You can come back any time."
          : "If you think this is a mistake, please talk to your school admin."}
      </p>
      {self && (
        <form action={reactivateAccount}>
          <button className="btn-primary">Reactivate my account</button>
        </form>
      )}
    </>
  );
}

export default function RemovedPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 text-center">
      <Suspense>
        <Body />
      </Suspense>
      <form action={signOut}>
        <button className="btn-secondary">Sign out</button>
      </form>
    </main>
  );
}
