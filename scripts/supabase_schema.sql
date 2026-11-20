-- GESTIONALE FEDE - SUPABASE POSTGRESQL SCHEMA (V2)

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Locations
create table if not exists locations (
    id text primary key,
    name text not null,
    color text default '#F472B6',
    address text default '',
    active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Service Prices (Listino per Sede)
create table if not exists service_prices (
    id text primary key,
    location_id text not null references locations(id) on delete cascade,
    name text not null,
    price numeric(10, 2) not null default 0.0,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Clients (Rubrica)
create table if not exists clients (
    id text primary key,
    first_name text,
    last_name text,
    full_name text not null,
    phone text,
    email text,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Appointments (PMU & Generici)
create table if not exists appointments (
    id text primary key,
    category text default 'pmu',
    client_id text references clients(id) on delete set null,
    client_name text not null,
    location_id text references locations(id) on delete set null,
    treatment text not null,
    appointment_date timestamp with time zone not null,
    end_time text,
    total_price numeric(10, 2) default 0.0,
    payment numeric(10, 2) default 0.0,
    balance numeric(10, 2) default 0.0,
    touch_up_date date,
    touch_up_time text,
    touch_up_end_time text,
    linked_appointment_id text,
    is_touch_up boolean default false,
    lead_source text,
    notes text,
    sync_google_calendar boolean default false,
    google_calendar_event_id text,
    used_gift_voucher boolean default false,
    used_gift_voucher_id text,
    used_gift_voucher_amount numeric(10, 2) default 0.0,
    status text default 'programmato',
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. Wedding Services (Spose & Eventi)
create table if not exists wedding_services (
    id text primary key,
    bride_name text not null,
    client_id text references clients(id) on delete set null,
    event_type text default 'Matrimonio',
    address text,
    wedding_date timestamp with time zone not null,
    end_time text,
    trial_date timestamp with time zone,
    trial_end_time text,
    people_count integer default 1,
    trial_deposit numeric(10, 2) default 0.0,
    wedding_balance numeric(10, 2) default 0.0,
    total_price numeric(10, 2) default 0.0,
    notes text,
    sync_google_calendar boolean default false,
    google_calendar_event_id text,
    google_calendar_trial_event_id text,
    google_calendar_event_ids jsonb default '{}'::jsonb,
    used_gift_voucher boolean default false,
    used_gift_voucher_id text,
    used_gift_voucher_amount numeric(10, 2) default 0.0,
    status text default 'programmato',
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. Expenses
create table if not exists expenses (
    id text primary key,
    date date not null,
    category text not null,
    item text,
    amount numeric(10, 2) not null default 0.0,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 7. Gift Vouchers (Buoni Regalo)
create table if not exists gift_vouchers (
    id text primary key,
    buyer_id text references clients(id) on delete set null,
    buyer_name text not null,
    recipient_id text references clients(id) on delete set null,
    recipient_name text,
    initial_amount numeric(10, 2) not null default 0.0,
    remaining_amount numeric(10, 2) not null default 0.0,
    amount numeric(10, 2) not null default 0.0,
    category text not null check (category in ('pmu', 'evento')),
    purchase_date date not null default current_date,
    is_used boolean default false,
    used_date date,
    notes text,
    payment_method text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 8. Settings
create table if not exists settings (
    key text primary key,
    value jsonb not null
);

-- Indexes on foreign keys and date filters
create index if not exists idx_service_prices_location_id on service_prices(location_id);
create index if not exists idx_appointments_client_id on appointments(client_id);
create index if not exists idx_appointments_location_id on appointments(location_id);
create index if not exists idx_appointments_date on appointments(appointment_date desc);
create index if not exists idx_wedding_services_client_id on wedding_services(client_id);
create index if not exists idx_wedding_services_date on wedding_services(wedding_date desc);
create index if not exists idx_expenses_date on expenses(date desc);
create index if not exists idx_gift_vouchers_buyer_id on gift_vouchers(buyer_id);
create index if not exists idx_gift_vouchers_recipient_id on gift_vouchers(recipient_id);
create index if not exists idx_gift_vouchers_purchase_date on gift_vouchers(purchase_date desc);

-- Row Level Security (RLS) setup
alter table locations enable row level security;
alter table service_prices enable row level security;
alter table clients enable row level security;
alter table appointments enable row level security;
alter table wedding_services enable row level security;
alter table expenses enable row level security;
alter table gift_vouchers enable row level security;
alter table settings enable row level security;

-- Public / Anon access policies for personal app with PIN protection
-- (To tighten security, migrate to Supabase Auth and restrict these policies to auth.uid())
create policy "Allow all on locations" on locations for all using (true) with check (true);
create policy "Allow all on service_prices" on service_prices for all using (true) with check (true);
create policy "Allow all on clients" on clients for all using (true) with check (true);
create policy "Allow all on appointments" on appointments for all using (true) with check (true);
create policy "Allow all on wedding_services" on wedding_services for all using (true) with check (true);
create policy "Allow all on expenses" on expenses for all using (true) with check (true);
create policy "Allow all on gift_vouchers" on gift_vouchers for all using (true) with check (true);
create policy "Allow all on settings" on settings for all using (true) with check (true);
