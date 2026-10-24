import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google sends students back here after they sign in.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}/home`);
  }

  // The database refuses emails that don't belong to a school (see
  // handle_new_user in the migrations), which shows up here as an error.
  const description = searchParams.get("error_description") ?? "";
  const reason = /roster/i.test(description) ? "roster" : description ? "school-email" : "failed";
  return NextResponse.redirect(`${origin}/login?error=${reason}`);
}
