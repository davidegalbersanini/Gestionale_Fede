-- GESTIONALE FEDE - RLS LOCKDOWN (SERVER-ONLY ACCESS)
-- Removes all public/anon/authenticated policies and revokes direct table access.
-- All database reads & writes go exclusively through authenticated Next.js API routes using SUPABASE_SERVICE_ROLE_KEY.

-- Drop all open policies
drop policy if exists "Allow all on locations" on public.locations;
drop policy if exists "Allow all on service_prices" on public.service_prices;
drop policy if exists "Allow all on clients" on public.clients;
drop policy if exists "Allow all on appointments" on public.appointments;
drop policy if exists "Allow all on wedding_services" on public.wedding_services;
drop policy if exists "Allow all on expenses" on public.expenses;
drop policy if exists "Allow all on gift_vouchers" on public.gift_vouchers;
drop policy if exists "Allow all on settings" on public.settings;

-- Ensure RLS stays enabled on every table
alter table public.locations enable row level security;
alter table public.service_prices enable row level security;
alter table public.clients enable row level security;
alter table public.appointments enable row level security;
alter table public.wedding_services enable row level security;
alter table public.expenses enable row level security;
alter table public.gift_vouchers enable row level security;
alter table public.settings enable row level security;

-- Revoke direct Data API access from anon & authenticated roles
revoke all on table public.locations from anon, authenticated;
revoke all on table public.service_prices from anon, authenticated;
revoke all on table public.clients from anon, authenticated;
revoke all on table public.appointments from anon, authenticated;
revoke all on table public.wedding_services from anon, authenticated;
revoke all on table public.expenses from anon, authenticated;
revoke all on table public.gift_vouchers from anon, authenticated;
revoke all on table public.settings from anon, authenticated;

notify pgrst, 'reload schema';
