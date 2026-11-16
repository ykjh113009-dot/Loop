import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// A student's profile photo. Photos are private, so this only answers for signed-in people of the same school
// (the database decides), and hands out a short-lived link. Without a photo it sends the illustrated avatar.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/avatar/[id]">) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return new NextResponse("Not found", { status: 404 });
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return new NextResponse("Sign in", { status: 401 });

  const { data: p } = await supabase.from("profiles").select("photo_path, avatar_icon").eq("id", id).maybeSingle();
  if (!p) return new NextResponse("Not found", { status: 404 });
  const headers = { "Cache-Control": "private, max-age=600" };
  if (p.photo_path) {
    const { data: signed } = await supabase.storage.from("post-images").createSignedUrl(p.photo_path, 900);
    if (signed?.signedUrl) return NextResponse.redirect(signed.signedUrl, { status: 302, headers });
  }
  return NextResponse.redirect(new URL(`/avatars/${p.avatar_icon}.svg`, _req.url), { status: 302, headers });
}
