-- Tempo Pay schema (publicly readable for now).
create extension if not exists "pgcrypto";

do $$
begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('merchant', 'customer');
  end if;
  if not exists (select 1 from pg_type where typname = 'invoice_status') then
    create type invoice_status as enum ('open', 'paid', 'void', 'expired');
  end if;
  if not exists (select 1 from pg_type where typname = 'payment_status') then
    create type payment_status as enum ('pending', 'confirmed', 'failed');
  end if;
end $$;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  address text not null unique,
  role user_role not null,
  seller_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists passkey_credentials (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  credential_id text not null unique,
  public_key text not null,
  address text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_used_at timestamptz
);

create table if not exists invoices (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references profiles(id) on delete cascade,
  status invoice_status not null default 'open',
  amount_usd numeric(20, 6) not null,
  token_address text not null,
  token_symbol text not null,
  token_decimals integer not null default 6,
  title text not null,
  description text,
  image_url text,
  invoice_display_id text,
  customer_address text,
  paid_at timestamptz,
  paid_tx_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references invoices(id) on delete cascade,
  status payment_status not null default 'pending',
  payer_address text not null,
  amount numeric(20, 6) not null,
  token_address text not null,
  tx_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_address_idx on profiles (address);
create index if not exists passkey_credentials_credential_idx on passkey_credentials (credential_id);
create index if not exists passkey_credentials_address_idx on passkey_credentials (address);
create index if not exists invoices_merchant_id_idx on invoices (merchant_id);
create index if not exists invoices_status_idx on invoices (status);
create index if not exists payments_invoice_id_idx on payments (invoice_id);

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists profiles_set_updated_at on profiles;
create trigger profiles_set_updated_at
before update on profiles
for each row execute procedure set_updated_at();

drop trigger if exists passkey_credentials_set_updated_at on passkey_credentials;
create trigger passkey_credentials_set_updated_at
before update on passkey_credentials
for each row execute procedure set_updated_at();

drop trigger if exists invoices_set_updated_at on invoices;
create trigger invoices_set_updated_at
before update on invoices
for each row execute procedure set_updated_at();

drop trigger if exists payments_set_updated_at on payments;
create trigger payments_set_updated_at
before update on payments
for each row execute procedure set_updated_at();

alter table profiles enable row level security;
alter table passkey_credentials enable row level security;
alter table invoices enable row level security;
alter table payments enable row level security;

-- Loose RLS policies for prototyping (publicly readable).
do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'profiles_public_select') then
    create policy profiles_public_select on profiles for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'profiles_public_insert') then
    create policy profiles_public_insert on profiles for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'profiles_public_update') then
    create policy profiles_public_update on profiles for update using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'passkeys_public_select') then
    create policy passkeys_public_select on passkey_credentials for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passkeys_public_insert') then
    create policy passkeys_public_insert on passkey_credentials for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'passkeys_public_update') then
    create policy passkeys_public_update on passkey_credentials for update using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'invoices_public_select') then
    create policy invoices_public_select on invoices for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'invoices_public_insert') then
    create policy invoices_public_insert on invoices for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'invoices_public_update') then
    create policy invoices_public_update on invoices for update using (true) with check (true);
  end if;

  if not exists (select 1 from pg_policies where policyname = 'payments_public_select') then
    create policy payments_public_select on payments for select using (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'payments_public_insert') then
    create policy payments_public_insert on payments for insert with check (true);
  end if;
  if not exists (select 1 from pg_policies where policyname = 'payments_public_update') then
    create policy payments_public_update on payments for update using (true) with check (true);
  end if;
end $$;
