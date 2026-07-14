// Centralized readable error helper — re-exports the canonical normalizer.
// Kept as a stable import path so all toast.error calls can use a single helper.
export { normalizeSupabaseError as getReadableError } from "./error-utils";
export { normalizeSupabaseError as default } from "./error-utils";
