import { NextResponse, type NextRequest } from "next/server";
import { getMe } from "@/lib/auth";
import { loadListingDetails } from "@/lib/market-details";

// The details of one listing for the popup. Only signed-in students of the school get an answer (the database checks again).
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/listing/[id]">) {
  const { id } = await ctx.params;
  const me = await getMe();
  if (!me || !me.onboarded_at) return new NextResponse("Sign in", { status: 401 });
  const details = await loadListingDetails(id, me);
  if (!details) return new NextResponse("Not found", { status: 404 });
  return NextResponse.json(details, { headers: { "Cache-Control": "private, no-store" } });
}
