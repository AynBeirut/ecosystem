-- 1. Secure lookup_user_id_by_email RPC permissions
revoke all on function public.lookup_user_id_by_email(text) from public;
revoke all on function public.lookup_user_id_by_email(text) from anon;
grant execute on function public.lookup_user_id_by_email(text) to authenticated;

-- 2. Prevent duplicate members (DB level)
create unique index if not exists organization_members_org_user_uniq
  on public.organization_members (organization_id, user_id);

-- 3. Owner safety: prevent deleting last owner
create or replace function public.prevent_last_owner_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'owner' then
    if (
      select count(*) from public.organization_members
      where organization_id = old.organization_id
        and role = 'owner'
    ) <= 1 then
      raise exception 'Cannot remove the last owner of an organization';
    end if;
  end if;
  return old;
end;
$$;

drop trigger if exists prevent_last_owner_delete_trigger on public.organization_members;
create trigger prevent_last_owner_delete_trigger
before delete on public.organization_members
for each row execute function public.prevent_last_owner_delete();

-- 3b. Same protection for role demotion (don't allow demoting the only owner)
create or replace function public.prevent_last_owner_demote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'owner' and new.role <> 'owner' then
    if (
      select count(*) from public.organization_members
      where organization_id = old.organization_id
        and role = 'owner'
    ) <= 1 then
      raise exception 'Cannot demote the last owner of an organization';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_last_owner_demote_trigger on public.organization_members;
create trigger prevent_last_owner_demote_trigger
before update on public.organization_members
for each row execute function public.prevent_last_owner_demote();

-- 4. Role change RLS: only owners of the org can change roles, and only owners can promote to owner
-- Helper: is the current user an owner of this org?
create or replace function public.is_org_owner(_org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = _org_id
      and user_id = auth.uid()
      and role = 'owner'
  )
$$;

revoke all on function public.is_org_owner(uuid) from public;
grant execute on function public.is_org_owner(uuid) to authenticated;

-- Replace broad self-policy with narrower per-command policies
drop policy if exists "Users manage own memberships" on public.organization_members;

-- SELECT: members can see rows for orgs they belong to
create policy "Members view org memberships"
on public.organization_members
for select
to authenticated
using (organization_id in (select public.user_org_ids()));

-- INSERT: a user may insert their own first membership (org creation),
-- OR an owner of the org may add anyone
create policy "Owners or self can insert memberships"
on public.organization_members
for insert
to authenticated
with check (
  user_id = auth.uid()
  or public.is_org_owner(organization_id)
);

-- UPDATE: only owners of the org can change roles
create policy "Only owners can change roles"
on public.organization_members
for update
to authenticated
using (public.is_org_owner(organization_id))
with check (public.is_org_owner(organization_id));

-- DELETE: owners can remove anyone; users can remove themselves
create policy "Owners or self can delete memberships"
on public.organization_members
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_org_owner(organization_id)
);

-- 5. Force organization_id NOT NULL on tenant tables (no nulls today)
alter table public.invoices       alter column organization_id set not null;
alter table public.estimates      alter column organization_id set not null;
alter table public.clients        alter column organization_id set not null;
alter table public.products       alter column organization_id set not null;
alter table public.suppliers      alter column organization_id set not null;
alter table public.receipts       alter column organization_id set not null;
alter table public.purchase_orders alter column organization_id set not null;