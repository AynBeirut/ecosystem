-- Helper to look up an auth user id by email for the invite (lookup-only) flow.
-- SECURITY DEFINER so RLS on auth.users (which is hidden) doesn't block us;
-- we only ever return the id, never the email or any other column.
CREATE OR REPLACE FUNCTION public.lookup_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1;
$$;

-- Restrict execution: only signed-in users can call this.
REVOKE ALL ON FUNCTION public.lookup_user_id_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.lookup_user_id_by_email(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.lookup_user_id_by_email(text) TO authenticated;