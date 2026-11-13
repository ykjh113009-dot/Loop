import "server-only";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, makeT, type Locale } from "@/lib/i18n";

// The language is remembered in a cookie so every page can read it.
export async function getLocale(): Promise<Locale> {
  return (await cookies()).get(LOCALE_COOKIE)?.value === "ar" ? "ar" : "en";
}

export async function getT() {
  const locale = await getLocale();
  return { t: makeT(locale), locale };
}
