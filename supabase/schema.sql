-- SiteFlow Affiliates — core schema.
-- Run once in this project's OWN Supabase SQL editor (a separate Supabase
-- project from SiteFlow's — this site never touches SiteFlow's database
-- directly, it only talks to it over the two HTTP integration points in
-- README.md).

-- ============================================================
-- AFFILIATES
-- One row per registered affiliate, 1:1 with auth.users. New signups start
-- 'pending' and cannot see the dashboard until an admin approves them.
-- ============================================================
create table if not exists public.affiliates (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  slug text not null unique,               -- referral code, e.g. "maria23"
  marketing_platform text,                 -- optional, entered at signup
  role text not null default 'affiliate' check (role in ('affiliate', 'admin')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'suspended')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

grant select on public.affiliates to authenticated;
grant select, insert, update, delete on public.affiliates to service_role;
-- SECURITY: affiliates may only edit these three columns of their own row.
-- status / role / email / id can only be changed by the server (service role),
-- so nobody can approve themselves or promote themselves to admin.
revoke update on public.affiliates from authenticated;
grant update (full_name, marketing_platform, slug) on public.affiliates to authenticated;

alter table public.affiliates enable row level security;

drop policy if exists "affiliates read own row" on public.affiliates;
create policy "affiliates read own row"
  on public.affiliates for select
  using (auth.uid() = id);

drop policy if exists "affiliates update own editable fields" on public.affiliates;
create policy "affiliates update own editable fields"
  on public.affiliates for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ============================================================
-- OLD SLUGS — when an affiliate edits their link, the previous slug is kept
-- here so customers who already signed up through the OLD link keep earning
-- the affiliate their monthly commission (SiteFlow stores the slug that was
-- in the link at signup time).
-- ============================================================
create table if not exists public.affiliate_old_slugs (
  slug text primary key,
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.affiliate_old_slugs to service_role;
alter table public.affiliate_old_slugs enable row level security;
-- no policies: only the service role (server) ever touches this table.

create or replace function public.remember_old_slug()
returns trigger as $$
begin
  if new.slug is distinct from old.slug then
    insert into public.affiliate_old_slugs (slug, affiliate_id)
      values (old.slug, old.id)
      on conflict (slug) do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists affiliates_remember_old_slug on public.affiliates;
create trigger affiliates_remember_old_slug
  after update of slug on public.affiliates
  for each row execute function public.remember_old_slug();

-- Admins can see every affiliate row. Checked via a small
-- helper so the policy itself stays simple.
create or replace function public.is_admin()
returns boolean as $$
  select exists (
    select 1 from public.affiliates
    where id = auth.uid() and role = 'admin' and status = 'approved'
  );
$$ language sql security definer stable;

drop policy if exists "admins read all affiliates" on public.affiliates;
create policy "admins read all affiliates"
  on public.affiliates for select
  using (public.is_admin());

-- (Admin approve/reject/suspend go through server API routes using the
-- service role, so no admin UPDATE policy is needed or wanted here.)
drop policy if exists "admins update all affiliates" on public.affiliates;

-- ============================================================
-- SIGNUP TRIGGER — auto-creates the affiliates row (status 'pending') the
-- moment someone confirms their email. slug/marketing_platform/full_name
-- come from supabase.auth.signUp({ options: { data: {...} } }) in
-- src/app/register/page.tsx.
-- ============================================================
create or replace function public.handle_new_affiliate()
returns trigger as $$
declare
  wanted text := lower(coalesce(new.raw_user_meta_data->>'slug', ''));
  final_slug text;
begin
  if wanted !~ '^[a-z0-9-]{3,40}$' then
    wanted := 'affiliate-' || substr(md5(random()::text), 1, 6);
  end if;
  final_slug := wanted;
  -- never let a slug collision make the whole signup fail
  while exists (select 1 from public.affiliates where slug = final_slug)
     or exists (select 1 from public.affiliate_old_slugs where slug = final_slug) loop
    final_slug := substr(wanted, 1, 33) || '-' || substr(md5(random()::text), 1, 5);
  end loop;

  insert into public.affiliates (id, email, full_name, slug, marketing_platform)
    values (
      new.id,
      new.email,
      new.raw_user_meta_data->>'full_name',
      final_slug,
      nullif(new.raw_user_meta_data->>'marketing_platform', '')
    );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_affiliate();

-- ============================================================
-- PAYOUT METHODS — one row per affiliate. Only one method is "active" at a
-- time (the one they last saved); we keep all three field groups so
-- switching methods doesn't lose previously entered details.
-- NOTE: bank_account_number is sensitive. RLS keeps it readable only by its
-- owner and admins, but it is NOT encrypted at the column level — see the
-- security note in README.md before handling real bank details at scale.
-- ============================================================
create table if not exists public.payout_methods (
  affiliate_id uuid primary key references public.affiliates(id) on delete cascade,
  active_method text check (active_method in ('paypal', 'bank', 'payoneer')),
  paypal_email text,
  bank_account_holder text,
  bank_account_number text,
  bank_routing_number text,
  bank_name text,
  bank_country text,
  payoneer_email text,
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.payout_methods to authenticated;
grant select, insert, update, delete on public.payout_methods to service_role;

alter table public.payout_methods enable row level security;

drop policy if exists "affiliates manage own payout method" on public.payout_methods;
create policy "affiliates manage own payout method"
  on public.payout_methods for all
  using (auth.uid() = affiliate_id)
  with check (auth.uid() = affiliate_id);

drop policy if exists "admins read all payout methods" on public.payout_methods;
create policy "admins read all payout methods"
  on public.payout_methods for select
  using (public.is_admin());

-- ============================================================
-- REFERRALS — first-touch attribution cache: which affiliate gets credit
-- for which SiteFlow customer email. One row per customer, globally unique
-- on customer_email so a customer can only ever belong to one affiliate.
-- ============================================================
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  customer_email text not null unique,
  first_seen_at timestamptz not null default now()
);

grant select on public.referrals to authenticated;
grant select, insert, update, delete on public.referrals to service_role;

alter table public.referrals enable row level security;

drop policy if exists "affiliates read own referrals" on public.referrals;
create policy "affiliates read own referrals"
  on public.referrals for select
  using (auth.uid() = affiliate_id);

drop policy if exists "admins read all referrals" on public.referrals;
create policy "admins read all referrals"
  on public.referrals for select
  using (public.is_admin());

-- ============================================================
-- COMMISSION EVENTS — the ledger. One row = one affiliate earning $7.50 for
-- one customer in one calendar month. The unique constraint on
-- (affiliate_id, customer_email, period) is what makes both the instant
-- webhook AND the daily reconciliation cron safe to run repeatedly without
-- ever double-paying the same month twice.
-- ============================================================
create table if not exists public.commission_events (
  id uuid primary key default gen_random_uuid(),
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  customer_email text not null,
  period text not null,                      -- 'YYYY-MM'
  amount_usd numeric(10, 2) not null default 7.50,
  source text not null check (source in ('webhook', 'reconciliation')),
  source_event_id text not null unique,
  status text not null default 'pending' check (status in ('pending', 'paid')),
  created_at timestamptz not null default now(),
  unique (affiliate_id, customer_email, period)
);

grant select on public.commission_events to authenticated;
grant select, insert, update, delete on public.commission_events to service_role;

alter table public.commission_events enable row level security;

drop policy if exists "affiliates read own commissions" on public.commission_events;
create policy "affiliates read own commissions"
  on public.commission_events for select
  using (auth.uid() = affiliate_id);

drop policy if exists "admins read all commissions" on public.commission_events;
create policy "admins read all commissions"
  on public.commission_events for select
  using (public.is_admin());

drop policy if exists "admins update all commissions" on public.commission_events;

create index if not exists commission_events_affiliate_period_idx
  on public.commission_events (affiliate_id, period);
