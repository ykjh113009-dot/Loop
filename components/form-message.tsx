import type { ActionResult } from "@/lib/errors";

export function FormMessage({ state }: { state: ActionResult }) {
  if (state?.error) {
    return <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>;
  }
  if (state?.message) {
    return <p role="status" className="rounded-xl bg-brand-50 px-3 py-2 text-sm text-brand-800">{state.message}</p>;
  }
  return null;
}
