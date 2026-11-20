-- GESTIONALE FEDE - IDEMPOTENT SCHEMA MIGRATION V2
-- Safe to run on existing Supabase databases (creates missing tables, columns, indexes, and migrates JSONB fallbacks).

-- 1. Locations
alter table if exists public.locations
    add column if not exists address text default '';

-- 2. Service Prices table
create table if not exists public.service_prices (
    id text primary key,
    location_id text not null references public.locations(id) on delete cascade,
    name text not null,
    price numeric(10, 2) not null default 0.0,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.service_prices enable row level security;
grant select, insert, update, delete on public.service_prices to anon, authenticated;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'service_prices'
          and policyname = 'Allow all on service_prices'
    ) then
        create policy "Allow all on service_prices"
            on public.service_prices for all using (true) with check (true);
    end if;
end $$;

-- 3. Gift Vouchers table
create table if not exists public.gift_vouchers (
    id text primary key,
    buyer_id text references public.clients(id) on delete set null,
    buyer_name text not null,
    recipient_id text references public.clients(id) on delete set null,
    recipient_name text,
    initial_amount numeric(10, 2) not null default 0.0,
    remaining_amount numeric(10, 2) not null default 0.0,
    amount numeric(10, 2) not null default 0.0,
    category text not null default 'pmu' check (category in ('pmu', 'evento')),
    purchase_date date not null default current_date,
    is_used boolean default false,
    used_date date,
    notes text,
    payment_method text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

alter table public.gift_vouchers enable row level security;
grant select, insert, update, delete on public.gift_vouchers to anon, authenticated;

do $$
begin
    if not exists (
        select 1 from pg_policies
        where schemaname = 'public'
          and tablename = 'gift_vouchers'
          and policyname = 'Allow all on gift_vouchers'
    ) then
        create policy "Allow all on gift_vouchers"
            on public.gift_vouchers for all using (true) with check (true);
    end if;
end $$;

-- Ensure columns exist if gift_vouchers already existed in v1 format
alter table if exists public.gift_vouchers
    add column if not exists recipient_id text references public.clients(id) on delete set null,
    add column if not exists recipient_name text,
    add column if not exists initial_amount numeric(10, 2) default 0.0,
    add column if not exists remaining_amount numeric(10, 2) default 0.0;

-- 4. Clients
alter table if exists public.clients
    add column if not exists first_name text,
    add column if not exists last_name text;

-- 5. Appointments
alter table if exists public.appointments
    add column if not exists category text default 'pmu',
    add column if not exists total_price numeric(10, 2) default 0.0,
    add column if not exists touch_up_end_time text,
    add column if not exists used_gift_voucher boolean default false,
    add column if not exists used_gift_voucher_id text,
    add column if not exists used_gift_voucher_amount numeric(10, 2) default 0.0;

update public.appointments
set total_price = coalesce(payment, 0) + coalesce(balance, 0)
where (total_price is null or total_price = 0)
  and (coalesce(payment, 0) + coalesce(balance, 0)) > 0;

-- 6. Wedding Services
alter table if exists public.wedding_services
    add column if not exists event_type text default 'Matrimonio',
    add column if not exists address text,
    add column if not exists end_time text,
    add column if not exists trial_end_time text,
    add column if not exists google_calendar_event_id text,
    add column if not exists google_calendar_trial_event_id text,
    add column if not exists used_gift_voucher boolean default false,
    add column if not exists used_gift_voucher_id text,
    add column if not exists used_gift_voucher_amount numeric(10, 2) default 0.0;

-- 7. Migrate existing service_prices from settings JSONB into public.service_prices
insert into public.service_prices (id, location_id, name, price, created_at)
select
    elem->>'id',
    elem->>'location_id',
    elem->>'name',
    coalesce((elem->>'price')::numeric(10, 2), 0.0),
    coalesce(nullif(elem->>'created_at', '')::timestamptz, timezone('utc'::text, now()))
from public.settings s,
     jsonb_array_elements(s.value) as elem
where s.key = 'service_prices'
  and jsonb_typeof(s.value) = 'array'
  and elem->>'id' is not null
  and exists (select 1 from public.locations l where l.id = elem->>'location_id')
on conflict (id) do nothing;

-- 8. Migrate existing gift_vouchers from settings JSONB into public.gift_vouchers
insert into public.gift_vouchers (
    id, buyer_id, buyer_name, recipient_id, recipient_name,
    initial_amount, remaining_amount, amount, category,
    purchase_date, is_used, used_date, notes, payment_method, created_at
)
select
    elem->>'id',
    case
        when nullif(elem->>'buyer_id', '') is not null
             and exists (select 1 from public.clients c where c.id = elem->>'buyer_id')
        then elem->>'buyer_id'
        else null
    end,
    coalesce(nullif(elem->>'buyer_name', ''), 'Cliente'),
    case
        when nullif(elem->>'recipient_id', '') is not null
             and exists (select 1 from public.clients c where c.id = elem->>'recipient_id')
        then elem->>'recipient_id'
        else null
    end,
    nullif(elem->>'recipient_name', ''),
    coalesce((elem->>'initial_amount')::numeric(10, 2), (elem->>'amount')::numeric(10, 2), 0.0),
    coalesce(
        (elem->>'remaining_amount')::numeric(10, 2),
        case when coalesce((elem->>'is_used')::boolean, false) then 0.0
             else coalesce((elem->>'initial_amount')::numeric(10, 2), (elem->>'amount')::numeric(10, 2), 0.0)
        end
    ),
    coalesce((elem->>'amount')::numeric(10, 2), (elem->>'initial_amount')::numeric(10, 2), 0.0),
    case when elem->>'category' in ('pmu', 'evento') then elem->>'category' else 'pmu' end,
    coalesce(nullif(left(elem->>'purchase_date', 10), '')::date, current_date),
    coalesce((elem->>'is_used')::boolean, false),
    nullif(left(elem->>'used_date', 10), '')::date,
    nullif(elem->>'notes', ''),
    nullif(elem->>'payment_method', ''),
    coalesce(nullif(elem->>'created_at', '')::timestamptz, timezone('utc'::text, now()))
from public.settings s,
     jsonb_array_elements(s.value) as elem
where s.key = 'gift_vouchers'
  and jsonb_typeof(s.value) = 'array'
  and elem->>'id' is not null
on conflict (id) do nothing;

-- Normalize initial_amount / remaining_amount on any pre-existing rows
update public.gift_vouchers
set
    initial_amount = coalesce(nullif(initial_amount, 0), amount),
    remaining_amount = case
        when remaining_amount is null or (remaining_amount = 0 and coalesce(is_used, false) = false)
            then coalesce(nullif(initial_amount, 0), amount)
        else remaining_amount
    end
where initial_amount is null or initial_amount = 0 or remaining_amount is null;

-- 9. Performance & FK Indexes
create index if not exists idx_service_prices_location_id on public.service_prices(location_id);
create index if not exists idx_appointments_client_id on public.appointments(client_id);
create index if not exists idx_appointments_location_id on public.appointments(location_id);
create index if not exists idx_appointments_date on public.appointments(appointment_date desc);
create index if not exists idx_wedding_services_client_id on public.wedding_services(client_id);
create index if not exists idx_wedding_services_date on public.wedding_services(wedding_date desc);
create index if not exists idx_expenses_date on public.expenses(date desc);
create index if not exists idx_gift_vouchers_buyer_id on public.gift_vouchers(buyer_id);
create index if not exists idx_gift_vouchers_recipient_id on public.gift_vouchers(recipient_id);
create index if not exists idx_gift_vouchers_purchase_date on public.gift_vouchers(purchase_date desc);

-- 10. Reload PostgREST schema cache
notify pgrst, 'reload schema';
