import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Relative redirects, so people always land on the address they came from.
// (Building an absolute address here goes wrong behind a proxy.)
const go = (path: string) => new NextResponse(null, { status: 307, headers: { Location: path } });

const NEXT_COOKIE = "loop_next";

// Google sends students back here after they sign in.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const providerError = searchParams.get("error");

  if (code && !providerError) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Security log: where this sign-in came from. Never blocks the sign-in.
      await supabase
        .rpc("record_security_event", {
          p_kind: "sign_in",
          p_ip: (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim(),
          p_user_agent: request.headers.get("user-agent") ?? "",
        })
        .then(() => null, () => null);
      // People who chose "Admin" on the sign-in page continue to the application form.
      const wantsAdmin = request.cookies.get(NEXT_COOKIE)?.value === "apply-admin";
      const response = go(wantsAdmin ? "/auth/continue?to=apply-admin" : "/auth/continue");
      response.cookies.delete(NEXT_COOKIE);
      return response;
    }
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
