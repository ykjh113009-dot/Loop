// Turns database errors into short messages a student can understand.
export function friendlyError(error: { message?: string; code?: string } | null | undefined): string {
  if (!error) return "Something went wrong. Please try again.";
  const message = error.message ?? "";
  if (error.code === "23505") return "That already exists.";
  if (error.code === "42501" || message.includes("row-level security")) {
    return "You are not allowed to do that.";
  }
  // Our own database messages look like "BLOCKED_WORD: Please remove…".
  const ours = /^(?:[A-Z_]+: )?(.+)$/.exec(message);
  if (ours && error.code === "P0001") return ours[1];
  return "Something went wrong. Please try again.";
}

export type ActionResult = { ok?: boolean; error?: string; message?: string } | null;
