import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";

// One Supabase client per request, signed in as the current student.
// The database security rules decide what they can see.
export const createClient = cache(async () => {
  // Every signed-in page is personal, so render it fresh for each request.
  await connection();
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a page, where cookies are read-only. The proxy
            // refreshes the session instead, so this is safe to ignore.
          }
        },
      },
    },
  );
});
