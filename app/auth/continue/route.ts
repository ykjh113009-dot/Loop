import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { afterSignInPath } from "@/lib/applications";

const go = (path: string) => new NextResponse(null, { status: 307, headers: { Location: path, "Cache-Control": "no-store" } });

// Every sign-in passes through here. People with an application decision they have not seen (or one still waiting)
// see that first; everyone else goes straight where they were going.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) return go("/login");
  const to = request.nextUrl.searchParams.get("to") === "apply-admin" ? "/apply-admin" : "/home";
  return go(await afterSignInPath(supabase, userId, to));
}
