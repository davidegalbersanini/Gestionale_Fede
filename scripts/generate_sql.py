import json
import os

json_path = r"c:\Users\User\Desktop\Gestionale_Fede\src\data\initialData.json"
with open(json_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

schema_sql = """-- GESTIONALE FEDE - SUPABASE POSTGRESQL SCHEMA

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
    payment numeric(10, 2) default 0.0,
    balance numeric(10, 2) default 0.0,
    touch_up_date date,
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

-- 6. Settings
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
alter table settings enable row level security;

-- Public / Anon access policies for personal app with PIN protection
create policy "Allow all on locations" on locations for all using (true) with check (true);
create policy "Allow all on clients" on clients for all using (true) with check (true);
create policy "Allow all on appointments" on appointments for all using (true) with check (true);
create policy "Allow all on wedding_services" on wedding_services for all using (true) with check (true);
create policy "Allow all on expenses" on expenses for all using (true) with check (true);
create policy "Allow all on settings" on settings for all using (true) with check (true);
"""

os.makedirs(r"c:\Users\User\Desktop\Gestionale_Fede\scripts", exist_ok=True)
with open(r"c:\Users\User\Desktop\Gestionale_Fede\scripts\supabase_schema.sql", 'w', encoding='utf-8') as f:
    f.write(schema_sql)

def escape_sql(val):
    if val is None:
        return "NULL"
    if isinstance(val, (int, float)):
        return str(val)
    if isinstance(val, bool):
        return "TRUE" if val else "FALSE"
    val_str = str(val).replace("'", "''")
    return f"'{val_str}'"

seed_statements = ["-- SEED DATA MIGRATION FROM EXCEL\n"]

# Locations
for loc in data["locations"]:
    seed_statements.append(
        f"INSERT INTO locations (id, name, color, active) VALUES ({escape_sql(loc['id'])}, {escape_sql(loc['name'])}, {escape_sql(loc['color'])}, {escape_sql(loc['active'])}) ON CONFLICT (id) DO NOTHING;"
    )

# Clients
for c in data["clients"]:
    seed_statements.append(
        f"INSERT INTO clients (id, full_name, phone, email, notes) VALUES ({escape_sql(c['id'])}, {escape_sql(c['full_name'])}, {escape_sql(c['phone'])}, {escape_sql(c['email'])}, {escape_sql(c['notes'])}) ON CONFLICT (id) DO NOTHING;"
    )

# Appointments
for a in data["appointments"]:
    seed_statements.append(
        f"INSERT INTO appointments (id, client_id, client_name, location_id, treatment, appointment_date, payment, balance, touch_up_date, lead_source, notes, status) VALUES ({escape_sql(a['id'])}, {escape_sql(a['client_id'])}, {escape_sql(a['client_name'])}, {escape_sql(a['location_id'])}, {escape_sql(a['treatment'])}, {escape_sql(a['appointment_date'])}, {escape_sql(a['payment'])}, {escape_sql(a['balance'])}, {escape_sql(a['touch_up_date'])}, {escape_sql(a['lead_source'])}, {escape_sql(a['notes'])}, {escape_sql(a['status'])}) ON CONFLICT (id) DO NOTHING;"
    )

# Weddings
for w in data["weddings"]:
    seed_statements.append(
        f"INSERT INTO wedding_services (id, bride_name, client_id, wedding_date, trial_date, people_count, trial_deposit, wedding_balance, total_price, notes, status) VALUES ({escape_sql(w['id'])}, {escape_sql(w['bride_name'])}, {escape_sql(w['client_id'])}, {escape_sql(w['wedding_date'])}, {escape_sql(w['trial_date'])}, {escape_sql(w['people_count'])}, {escape_sql(w['trial_deposit'])}, {escape_sql(w['wedding_balance'])}, {escape_sql(w['total_price'])}, {escape_sql(w['notes'])}, {escape_sql(w['status'])}) ON CONFLICT (id) DO NOTHING;"
    )

# Expenses
for e in data["expenses"]:
    seed_statements.append(
        f"INSERT INTO expenses (id, date, category, item, amount, notes) VALUES ({escape_sql(e['id'])}, {escape_sql(e['date'])}, {escape_sql(e['category'])}, {escape_sql(e['item'])}, {escape_sql(e['amount'])}, {escape_sql(e['notes'])}) ON CONFLICT (id) DO NOTHING;"
    )

with open(r"c:\Users\User\Desktop\Gestionale_Fede\scripts\supabase_seed.sql", 'w', encoding='utf-8') as f:
    f.write("\n".join(seed_statements))

print("Generated supabase_schema.sql and supabase_seed.sql successfully!")
