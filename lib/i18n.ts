import { AR } from "@/lib/i18n-ar";

export type Locale = "en" | "ar";
export const LOCALES: { code: Locale; name: string }[] = [
  { code: "en", name: "English" },
  { code: "ar", name: "العربية" },
];
export const LOCALE_COOKIE = "loop_locale";

// Translation works like this: the English sentence is the key. Arabic text
// lives in lib/i18n-ar.ts; anything not translated yet falls back to English.
// "{name}" style placeholders are filled from `vars`.
export function makeT(locale: Locale) {
  return (text: string, vars?: Record<string, string | number>) => {
    let out = locale === "ar" ? (AR[text] ?? text) : text;
    if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
    return out;
  };
}
export type T = ReturnType<typeof makeT>;
