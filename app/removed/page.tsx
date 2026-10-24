import { signOut } from "@/app/actions/auth";

export const metadata = { title: "Account removed" };

export default function RemovedPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 text-center">
      <div className="text-4xl">🔒</div>
      <h1 className="text-xl font-bold">This account has been removed</h1>
      <p className="text-black/60">If you think this is a mistake, please talk to your school admin.</p>
      <form action={signOut}>
        <button className="btn-secondary">Sign out</button>
      </form>
    </main>
  );
}
