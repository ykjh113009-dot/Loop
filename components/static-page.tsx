import Link from "next/link";

export function StaticPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <Link href="/home" className="text-sm text-brand-700 underline">← Back to Loop</Link>
      <h1 className="mt-4 text-2xl font-bold">{title}</h1>
      <div className="mt-4 space-y-4 leading-relaxed text-black/80 [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </div>
    </main>
  );
}
