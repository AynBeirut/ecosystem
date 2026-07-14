// User-friendly error normalization
export function normalizeSupabaseError(err: any): string {
  if (!err) return "Unknown error";
  const msg = (err.message || err.error_description || err.error || String(err)).toLowerCase();
  const code = err.code || err.status;

  if (code === "PGRST301" || msg.includes("jwt") || msg.includes("token")) return "Your session expired. Please sign in again.";
  if (code === "42501" || msg.includes("row-level security") || msg.includes("permission denied"))
    return "You don't have permission to perform this action.";
  if (code === "23505" || msg.includes("duplicate key")) return "This record already exists.";
  if (code === "23503" || msg.includes("foreign key")) return "Related record is missing or in use.";
  if (code === "23514" || msg.includes("check constraint") || msg.includes("violates")) return "Invalid data submitted.";
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) return "Invalid email or password.";
  if (msg.includes("email not confirmed")) return "Please confirm your email before signing in.";
  if (msg.includes("user already registered")) return "An account with this email already exists.";
  if (msg.includes("rate limit") || code === 429) return "Too many requests. Please try again shortly.";
  if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch"))
    return "Network error. Check your connection and try again.";
  if (msg.includes("timeout") || msg.includes("timed out")) return "Request timed out. Please retry.";
  if (msg.includes("webhook")) return "Payment confirmation is still pending. This may take a moment.";

  return err.message || "Something went wrong. Please try again.";
}

export function getReadableError(err: unknown): string {
  return normalizeSupabaseError(err);
}
