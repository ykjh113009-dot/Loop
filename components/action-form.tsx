"use client";

import { useActionState } from "react";
import { FormMessage } from "@/components/form-message";
import type { ActionResult } from "@/lib/errors";

// A small form that calls a server action and shows its result message.
export function ActionForm({
  action,
  children,
  className,
}: {
  action: (state: ActionResult, formData: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {(state?.error || state?.message) && (
        <div className="mt-2 w-full">
          <FormMessage state={state} />
        </div>
      )}
    </form>
  );
}
