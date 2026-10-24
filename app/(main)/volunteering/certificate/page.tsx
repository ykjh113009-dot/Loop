import { Suspense } from "react";
import { createHash } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMe } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatShortDate } from "@/lib/time";
import { PageSkeleton } from "@/components/skeleton";
import { PrintButton } from "./print-button";

export const metadata = { title: "Volunteering certificate" };

const longDate = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Hebron", day: "numeric", month: "long", year: "numeric" });

async function Certificate({ searchParams }: { searchParams: PageProps<"/volunteering/certificate">["searchParams"] }) {
  const me = await requireMe();
  const { student } = await searchParams;
  // Moderators can open any student's certificate; students only their own.
  const studentId = me.isStaff && typeof student === "string" ? student : me.id;
  const supabase = await createClient();
  const [{ data: profile }, { data: entries }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, grade").eq("id", studentId).maybeSingle(),
    supabase
      .from("volunteer_entries")
      .select("id, organization, activity_date, hours, reviewed_at")
      .eq("profile_id", studentId)
      .eq("status", "approved")
      .order("activity_date"),
  ]);
  if (!profile) notFound();
  const rows = entries ?? [];
  const total = rows.reduce((s, e) => s + Number(e.hours), 0);
  const issued = new Date();
  // A short code the school can use to check the certificate is real.
  const code = createHash("sha256")
    .update(`${profile.id}|${total}|${rows.map((r) => r.id).join(",")}`)
    .digest("hex")
    .slice(0, 10)
    .toUpperCase()
    .replace(/(.{5})/, "$1-");

  if (rows.length === 0) {
    return <p className="text-sm text-black/60">There are no approved volunteering hours yet.</p>;
  }

  return (
    <div className="space-y-4">
      <Link href={studentId === me.id ? "/volunteering" : `/admin/students/${studentId}`} className="text-sm text-brand-700 print:hidden">← Back</Link>
      <PrintButton />
      <p className="text-xs text-black/50 print:hidden">
        On a phone: tap the button, then choose <strong>Save as PDF</strong> as the printer.
      </p>
      <article className="certificate mx-auto aspect-[1.414] w-full max-w-3xl rounded-xl border-8 border-double border-brand-700 bg-white p-6 text-center shadow-sm sm:p-10 print:aspect-auto print:max-w-none print:rounded-none print:shadow-none">
        <p className="text-xs font-semibold tracking-[0.3em] text-brand-700 uppercase">{me.school.name}</p>
        <h1 className="mt-3 text-2xl font-bold sm:text-4xl">Certificate of Volunteering</h1>
        <p className="mt-4 text-sm text-black/60 sm:text-base">This certifies that</p>
        <p className="mt-1 text-xl font-bold text-brand-800 sm:text-3xl" dir="auto">{profile.full_name}</p>
        {profile.grade && <p className="text-sm text-black/60">Grade {profile.grade}</p>}
        <p className="mt-3 text-sm sm:text-base">
          completed <strong className="text-brand-800">{total} hours</strong> of community volunteering:
        </p>
        <table className="mx-auto mt-3 w-full max-w-md text-left text-xs sm:text-sm">
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-black/10">
                <td className="py-1 pr-2 whitespace-nowrap text-black/55">{formatShortDate(r.activity_date)}</td>
                <td className="py-1 pr-2" dir="auto">{r.organization}</td>
                <td className="py-1 text-right tabular-nums">{Number(r.hours)} h</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-8 grid grid-cols-2 gap-6 text-xs text-black/60 sm:text-sm">
          <div>
            <div className="mx-auto h-8 w-40 border-b border-black/40" />
            <p className="mt-1">School principal</p>
          </div>
          <div>
            <p className="font-medium text-black/80">{longDate.format(issued)}</p>
            <p className="mt-1">Date issued</p>
          </div>
        </div>
        <p className="mt-6 text-[10px] text-black/40">
          Certificate no. {code} · Hours checked by the school&apos;s Pbs Go moderators
        </p>
      </article>
    </div>
  );
}

export default function CertificatePage(props: PageProps<"/volunteering/certificate">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Certificate searchParams={props.searchParams} />
    </Suspense>
  );
}
