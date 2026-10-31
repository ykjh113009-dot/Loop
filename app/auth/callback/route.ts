import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Relative redirects, so people always land on the address they came from.
// (Building an absolute address here goes wrong behind a proxy.)
const go = (path: string) => new NextResponse(null, { status: 307, headers: { Location: path } });

// Google sends students back here after they sign in.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const providerError = searchParams.get("error");

  if (code && !providerError) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return go("/home");
  }

  // Why the sign-in did not finish:
  // - the student closed or refused Google,
  // - the database refused the account (not a school email, not on the list),
  //   which Supabase reports as "Database error saving new user",
  // - anything else.
  const description = searchParams.get("error_description") ?? "";
  let reason = "failed";
  if (providerError === "access_denied") reason = "cancelled";
  else if (/roster/i.test(description)) reason = "roster";
  else if (/database error|saving new user|school|not allowed/i.test(description)) reason = "school-email";
  return go(`/login?error=${reason}`);
}
