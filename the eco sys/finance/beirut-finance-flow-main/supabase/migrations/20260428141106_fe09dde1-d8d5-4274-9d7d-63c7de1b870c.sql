-- ============ 1. PLANS ============
alter table public.organizations
  add column if not exists plan text not null default 'free'
  check (plan in ('free','paid','pro'));

-- Seat limit lookup
create or replace function public.org_seat_limit(_plan text)
returns integer
language sql
immutable
as $$
  select case _plan
    when 'free' then 1
    when 'paid' then 5
    when 'pro'  then 10
    else 1
  end
$$;

-- Enforce seat limit on member insert
create or replace function public.enforce_org_seat_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  _plan text;
  _limit int;
  _count int;
begin
  select plan into _plan from public.organizations where id = new.organization_id;
  if _plan is null then return new; end if;
  _limit := public.org_seat_limit(_plan);
  select count(*) into _count from public.organization_members where organization_id = new.organization_id;
  if _count >= _limit then
    raise exception 'Plan limit reached: % allows % member(s).', _plan, _limit
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_org_seat_limit_trigger on public.organization_members;
create trigger enforce_org_seat_limit_trigger
before insert on public.organization_members
for each row execute function public.enforce_org_seat_limit();

-- ============ 2. EXPANDED ROLES ============
-- role is text (no enum), just widen the allowed set via check
alter table public.organization_members
  drop constraint if exists organization_members_role_check;

alter table public.organization_members
  add constraint organization_members_role_check
  check (role in ('owner','admin','manager','agent','assistant','member'));

-- Permission helper
create or replace function public.has_permission(_action text, _org_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with my as (
    select role from public.organization_members
    where user_id = auth.uid() and organization_id = _org_id
    limit 1
  )
  select case
    when (select role from my) is null then false
    when (select role from my) = 'owner' then true
    when _action = 'manage_billing' then (select role from my) = 'owner'
    when _action = 'delete_org' then (select role from my) = 'owner'
    when _action = 'manage_members' then (select role from my) in ('owner','admin')
    when _action = 'view_admin' then (select role from my) in ('owner','admin')
    when _action = 'manage_payment_methods' then (select role from my) in ('owner','admin')
    when _action = 'manage_invoices' then (select role from my) in ('owner','admin','manager')
    when _action = 'manage_projects' then (select role from my) in ('owner','admin','manager')
    when _action = 'write_timesheets' then (select role from my) in ('owner','admin','manager','agent')
    when _action = 'read' then true
    else false
  end
$$;

revoke all on function public.has_permission(text, uuid) from public;
grant execute on function public.has_permission(text, uuid) to authenticated;

-- ============ 3. PAYMENT METHODS ============
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  type text not null check (type in ('stripe','paypal','wish','omt','bank','card')),
  label text,
  config jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_methods_org_idx on public.payment_methods(organization_id);

alter table public.payment_methods enable row level security;

-- All org members can SELECT (needed so invoice page can list active methods)
create policy "Org members read payment_methods"
on public.payment_methods
for select
to authenticated
using (organization_id in (select public.user_org_ids()));

-- Only owner/admin can write
create policy "Owner or admin insert payment_methods"
on public.payment_methods
for insert
to authenticated
with check (public.has_permission('manage_payment_methods', organization_id));

create policy "Owner or admin update payment_methods"
on public.payment_methods
for update
to authenticated
using (public.has_permission('manage_payment_methods', organization_id))
with check (public.has_permission('manage_payment_methods', organization_id));

create policy "Owner or admin delete payment_methods"
on public.payment_methods
for delete
to authenticated
using (public.has_permission('manage_payment_methods', organization_id));

create trigger payment_methods_set_updated_at
before update on public.payment_methods
for each row execute function public.update_updated_at_column();

-- ============ 4. INVOICES: payment_method column ============
alter table public.invoices
  add column if not exists payment_method text;