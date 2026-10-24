import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-5 text-center">
      <div className="text-4xl">🧭</div>
      <h1 className="text-xl font-bold">We couldn&apos;t find that</h1>
      <p className="text-black/60">It may have been removed, or you may not have access to it.</p>
      <Link href="/home" className="btn-primary">Go home</Link>
    </main>
  );
}
