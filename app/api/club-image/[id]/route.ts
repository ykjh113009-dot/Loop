import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// A club's picture, for any place that shows the club. Pictures are private to the school, so this only answers
// for signed-in people (the database decides), and hands out a short-lived link.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/club-image/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return new NextResponse("Sign in", { status: 401 });
  const { data: club } = await supabase.from("clubs").select("image_path").eq("id", id).maybeSingle();
  if (!club?.image_path) return new NextResponse("Not found", { status: 404 });
  const { data: signed } = await supabase.storage.from("club-images").createSignedUrl(club.image_path, 900);
  if (!signed?.signedUrl) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(signed.signedUrl, { status: 302, headers: { "Cache-Control": "private, max-age=600" } });
}
