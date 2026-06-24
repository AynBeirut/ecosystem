
-- 1) Prevent client from reading the encrypted config column (contains Stripe secret keys).
-- Edge functions use the service_role key and bypass column grants.
REVOKE SELECT (config) ON public.payment_methods FROM authenticated, anon;

-- 2) Lock down email enumeration RPC to org owners/admins only.
CREATE OR REPLACE FUNCTION public.lookup_user_id_by_email(_email text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _allowed boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND role IN ('owner','admin')
  ) INTO _allowed;

  IF NOT _allowed THEN
    RAISE EXCEPTION 'Permission denied' USING ERRCODE = '42501';
  END IF;

  RETURN (SELECT id FROM auth.users WHERE lower(email) = lower(_email) LIMIT 1);
END;
$$;
