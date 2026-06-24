-- Atomic, security-definer organization bootstrap.
-- Fixes: client-side INSERT ... RETURNING on organizations fails with 42501
-- because the org SELECT policy (id IN user_org_ids()) cannot see the new row
-- before the owner membership exists (chicken-and-egg).
CREATE OR REPLACE FUNCTION public.bootstrap_organization(_name text DEFAULT 'My Organization')
RETURNS TABLE (
  id uuid, name text, plan text, logo_url text, address text,
  phone text, email text, tax_id text, currency text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _org_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF _name IS NULL OR length(trim(_name)) = 0 THEN
    _name := 'My Organization';
  END IF;

  -- Create the organization
  INSERT INTO public.organizations (name, plan)
  VALUES (trim(_name), 'free')
  RETURNING organizations.id INTO _org_id;

  -- Create the owner membership atomically
  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (_org_id, _uid, 'owner');

  RETURN QUERY
    SELECT o.id, o.name, o.plan, o.logo_url, o.address, o.phone, o.email, o.tax_id, o.currency
    FROM public.organizations o
    WHERE o.id = _org_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bootstrap_organization(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bootstrap_organization(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bootstrap_organization(text) TO service_role;