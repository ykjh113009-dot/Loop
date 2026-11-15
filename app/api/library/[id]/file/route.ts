import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Opens or downloads a library file. The database decides whether this person may have it; the link
// is created for this request only and the download is counted only when it worked.
export async function GET(req: NextRequest, ctx: RouteContext<"/api/library/[id]/file">) {
  const { id } = await ctx.params;
  const kind = req.nextUrl.searchParams.get("kind") === "download" ? "download" : "read";
  const revision = req.nextUrl.searchParams.get("rev");
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return NextResponse.redirect(new URL("/login", req.url));

  const { data: info } = await supabase.rpc("library_file_info", { p_resource: id, p_kind: kind, p_revision: revision ?? undefined });
  const file = info as { path: string; name: string | null } | null;
  if (!file) return new NextResponse("Not found", { status: 404 });

  const { data: signed } = await supabase.storage
    .from("library-files")
    .createSignedUrl(file.path, 120, kind === "download" ? { download: file.name ?? true } : undefined);
  if (!signed?.signedUrl) return new NextResponse("The file could not be opened.", { status: 502 });
  if (kind === "download" && !revision) await supabase.rpc("library_track", { p_resource: id, p_kind: "download" });
  return NextResponse.redirect(signed.signedUrl, { status: 302, headers: { "Cache-Control": "no-store" } });
}
