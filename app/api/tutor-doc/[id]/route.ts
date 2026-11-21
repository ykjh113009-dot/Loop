import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Opens one tutor document (a CV, a certificate...). The database decides who may see it: the tutor, the reviewers,
// and, only if the tutor chose to share it on their profile, signed-in students of the same school.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/tutor-doc/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return new NextResponse("Sign in", { status: 401 });
  const { data: doc } = await supabase.from("tutor_application_documents").select("path").eq("id", id).maybeSingle();
  if (!doc?.path) return new NextResponse("Not found", { status: 404 });
  const { data: signed } = await supabase.storage.from("tutor-docs").createSignedUrl(doc.path, 600);
  if (!signed?.signedUrl) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { status: 302, headers: { "Cache-Control": "private, no-store" } });
}
