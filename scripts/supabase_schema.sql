-- GESTIONALE FEDE - SUPABASE POSTGRESQL SCHEMA

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. Locations
create table if not exists locations (
    id text primary key,
    name text not null,
    color text default '#ec4899',
    active boolean default true,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Clients (Rubrica)
create table if not exists clients (
    id text primary key,
    full_name text not null,
    phone text,
    email text,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Appointments (PMU & Tatuaggi)
create table if not exists appointments (
    id text primary key,
    client_id text references clients(id) on delete set null,
    client_name text not null,
    location_id text references locations(id) on delete set null,
    treatment text not null,
    appointment_date timestamp with time zone not null,
    end_time text,
    payment numeric(10, 2) default 0.0,
    balance numeric(10, 2) default 0.0,
    touch_up_date date,
    touch_up_time text,
    linked_appointment_id text,
    is_touch_up boolean default false,
    lead_source text,
    notes text,
    sync_google_calendar boolean default false,
    google_calendar_event_id text,
    status text default 'programmato',
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 4. Wedding Services (Spose & Makeup)
create table if not exists wedding_services (
    id text primary key,
    bride_name text not null,
    client_id text references clients(id) on delete set null,
    wedding_date timestamp with time zone not null,
    trial_date timestamp with time zone,
    people_count integer default 1,
    trial_deposit numeric(10, 2) default 0.0,
    wedding_balance numeric(10, 2) default 0.0,
    total_price numeric(10, 2) default 0.0,
    notes text,
    sync_google_calendar boolean default false,
    google_calendar_event_ids jsonb default '{}'::jsonb,
    status text default 'programmato',
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 5. Expenses
create table if not exists expenses (
    id text primary key,
    date date not null,
    category text not null,
    item text,
    amount numeric(10, 2) not null default 0.0,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 6. Gift Vouchers (Buoni Regalo)
create table if not exists gift_vouchers (
    id text primary key,
    buyer_id text references clients(id) on delete set null,
    buyer_name text not null,
    amount numeric(10, 2) not null default 0.0,
    category text not null check (category in ('pmu', 'evento')),
    purchase_date date not null default current_date,
    is_used boolean default false,
    used_date date,
    notes text,
    payment_method text,
    created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 7. Settings
create table if not exists settings (
    key text primary key,
    value jsonb not null
);

-- Row Level Security (RLS) setup
alter table locations enable row level security;
alter table clients enable row level security;
alter table appointments enable row level security;
alter table wedding_services enable row level security;
alter table expenses enable row level security;
alter table gift_vouchers enable row level security;
alter table settings enable row level security;

-- Public / Anon access policies for personal app with PIN protection
create policy "Allow all on locations" on locations for all using (true) with check (true);
create policy "Allow all on clients" on clients for all using (true) with check (true);
create policy "Allow all on appointments" on appointments for all using (true) with check (true);
create policy "Allow all on wedding_services" on wedding_services for all using (true) with check (true);
create policy "Allow all on expenses" on expenses for all using (true) with check (true);
create policy "Allow all on gift_vouchers" on gift_vouchers for all using (true) with check (true);
create policy "Allow all on settings" on settings for all using (true) with check (true);
