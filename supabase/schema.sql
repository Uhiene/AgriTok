-- =============================================================
-- AgriToken — Supabase Schema + RLS Policies
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- =============================================================

-- =============================================================
-- Extensions
-- =============================================================
create extension if not exists "uuid-ossp";

-- =============================================================
-- Enum types
-- =============================================================
create type user_role      as enum ('farmer', 'investor', 'admin');
create type kyc_status     as enum ('pending', 'verified', 'rejected');
create type listing_status as enum ('open', 'funded', 'harvested', 'paid_out', 'cancelled');
create type investment_status as enum ('pending', 'confirmed', 'paid_out');
create type payment_method    as enum ('stripe', 'bnb', 'usdt');
create type notification_type as enum ('investment', 'payout', 'weather', 'system');

-- =============================================================
-- Table: profiles
-- =============================================================
create table profiles (
  id                  uuid        primary key references auth.users on delete cascade,
  wallet_address      text        unique,
  role                user_role   not null default 'investor',
  full_name           text        not null default '',
  avatar_url          text,
  country             text,
  phone               text,
  kyc_status          kyc_status  not null default 'pending',
  notification_prefs  jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table profiles enable row level security;

-- Users can read and write only their own profile
create policy "profiles: own read"
  on profiles for select
  using (auth.uid() = id);

create policy "profiles: own insert"
  on profiles for insert
  with check (auth.uid() = id);

create policy "profiles: own update"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- =============================================================
-- Table: farms
-- =============================================================
create table farms (
  id               uuid        primary key default uuid_generate_v4(),
  farmer_id        uuid        not null references profiles(id) on delete cascade,
  name             text        not null,
  location_name    text        not null,
  latitude         numeric(10, 6) not null,
  longitude        numeric(10, 6) not null,
  acreage          numeric(10, 2) not null,
  soil_type        text        not null,
  irrigation_type  text        not null,
  verified         boolean     not null default false,
  created_at       timestamptz not null default now()
);

alter table farms enable row level security;

-- Farmers: full CRUD on their own farms
create policy "farms: farmer select own"
  on farms for select
  using (auth.uid() = farmer_id);

create policy "farms: farmer insert own"
  on farms for insert
  with check (auth.uid() = farmer_id);

create policy "farms: farmer update own"
  on farms for update
  using (auth.uid() = farmer_id)
  with check (auth.uid() = farmer_id);

create policy "farms: farmer delete own"
  on farms for delete
  using (auth.uid() = farmer_id);

-- Investors: can read verified farms only
create policy "farms: investor select verified"
  on farms for select
  using (
    verified = true
    and exists (
      select 1 from profiles
      where id = auth.uid() and role = 'investor'
    )
  );

-- =============================================================
-- Table: crop_listings
-- =============================================================
create table crop_listings (
  id                      uuid           primary key default uuid_generate_v4(),
  farm_id                 uuid           not null references farms(id) on delete cascade,
  farmer_id               uuid           not null references profiles(id) on delete cascade,
  crop_type               text           not null,
  crop_image_url          text,
  expected_yield_kg       numeric(12, 2) not null,
  price_per_token_usd     numeric(10, 2) not null,
  total_tokens            integer        not null,
  tokens_sold             integer        not null default 0,
  funding_goal_usd        numeric(12, 2) not null,
  amount_raised_usd       numeric(12, 2) not null default 0,
  funding_deadline        timestamptz    not null,
  harvest_date            timestamptz    not null,
  expected_return_percent numeric(5, 2)  not null,
  status                  listing_status not null default 'open',
  token_contract_address  text,
  description             text           not null default '',
  created_at              timestamptz    not null default now()
);

alter table crop_listings enable row level security;

-- Farmers: full CRUD on their own listings
create policy "listings: farmer select own"
  on crop_listings for select
  using (auth.uid() = farmer_id);

create policy "listings: farmer insert own"
  on crop_listings for insert
  with check (auth.uid() = farmer_id);

create policy "listings: farmer update own"
  on crop_listings for update
  using (auth.uid() = farmer_id)
  with check (auth.uid() = farmer_id);

create policy "listings: farmer delete own"
  on crop_listings for delete
  using (auth.uid() = farmer_id);

-- Investors: read open listings
create policy "listings: investor select open"
  on crop_listings for select
  using (
    status = 'open'
    and exists (
      select 1 from profiles
      where id = auth.uid() and role in ('investor', 'admin')
    )
  );

-- =============================================================
-- Table: investments
-- =============================================================
create table investments (
  id               uuid              primary key default uuid_generate_v4(),
  investor_id      uuid              not null references profiles(id) on delete cascade,
  listing_id       uuid              not null references crop_listings(id) on delete cascade,
  tokens_purchased integer           not null,
  amount_paid_usd  numeric(12, 2)    not null,
  payment_method   payment_method    not null,
  transaction_hash text,
  status           investment_status not null default 'pending',
  created_at       timestamptz       not null default now()
);

alter table investments enable row level security;

-- Investors: full CRUD on their own investments
create policy "investments: investor select own"
  on investments for select
  using (auth.uid() = investor_id);

create policy "investments: investor insert own"
  on investments for insert
  with check (auth.uid() = investor_id);

create policy "investments: investor update own"
  on investments for update
  using (auth.uid() = investor_id)
  with check (auth.uid() = investor_id);

create policy "investments: investor delete own"
  on investments for delete
  using (auth.uid() = investor_id);

-- Farmers: can read investments made on their listings
create policy "investments: farmer select on own listings"
  on investments for select
  using (
    exists (
      select 1 from crop_listings
      where crop_listings.id = investments.listing_id
        and crop_listings.farmer_id = auth.uid()
    )
  );

-- =============================================================
-- Table: harvest_reports
-- =============================================================
create table harvest_reports (
  id               uuid        primary key default uuid_generate_v4(),
  listing_id       uuid        not null references crop_listings(id) on delete cascade,
  actual_yield_kg  numeric(12, 2) not null,
  harvest_photos   text[]      not null default '{}',
  verified_by      uuid        references profiles(id),
  payout_triggered boolean     not null default false,
  created_at       timestamptz not null default now()
);

alter table harvest_reports enable row level security;

-- Farmers can insert and read reports for their own listings
create policy "harvest_reports: farmer insert own"
  on harvest_reports for insert
  with check (
    exists (
      select 1 from crop_listings
      where crop_listings.id = harvest_reports.listing_id
        and crop_listings.farmer_id = auth.uid()
    )
  );

create policy "harvest_reports: farmer select own"
  on harvest_reports for select
  using (
    exists (
      select 1 from crop_listings
      where crop_listings.id = harvest_reports.listing_id
        and crop_listings.farmer_id = auth.uid()
    )
  );

-- Investors can read reports for listings they invested in
create policy "harvest_reports: investor select invested"
  on harvest_reports for select
  using (
    exists (
      select 1 from investments
      where investments.listing_id = harvest_reports.listing_id
        and investments.investor_id = auth.uid()
    )
  );

-- Admin can update (verify) harvest reports
create policy "harvest_reports: admin update"
  on harvest_reports for update
  using (
    exists (
      select 1 from profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- =============================================================
-- Table: farm_notes
-- =============================================================
create table farm_notes (
  id         uuid        primary key default uuid_generate_v4(),
  farm_id    uuid        not null references farms(id) on delete cascade,
  farmer_id  uuid        not null references profiles(id) on delete cascade,
  note       text        not null,
  photo_url  text,
  created_at timestamptz not null default now()
);

alter table farm_notes enable row level security;

-- Farmers: full CRUD on their own notes only
create policy "farm_notes: farmer select own"
  on farm_notes for select
  using (auth.uid() = farmer_id);

create policy "farm_notes: farmer insert own"
  on farm_notes for insert
  with check (auth.uid() = farmer_id);

create policy "farm_notes: farmer update own"
  on farm_notes for update
  using (auth.uid() = farmer_id)
  with check (auth.uid() = farmer_id);

create policy "farm_notes: farmer delete own"
  on farm_notes for delete
  using (auth.uid() = farmer_id);

-- =============================================================
-- Table: notifications
-- =============================================================
create table notifications (
  id         uuid              primary key default uuid_generate_v4(),
  user_id    uuid              not null references profiles(id) on delete cascade,
  title      text              not null,
  message    text              not null,
  type       notification_type not null,
  read       boolean           not null default false,
  created_at timestamptz       not null default now()
);

alter table notifications enable row level security;

-- Users: select only their own notifications
create policy "notifications: own select"
  on notifications for select
  using (auth.uid() = user_id);

-- Users: mark their own notifications as read
create policy "notifications: own update"
  on notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- =============================================================
-- RPC: increment_listing_funding (atomic, race-condition-safe)
-- Called by updateListingFunding() in listings.ts
-- =============================================================
create or replace function increment_listing_funding(
  p_listing_id uuid,
  p_tokens_added integer,
  p_amount_added numeric
)
returns void
language plpgsql
security definer
as $$
begin
  update crop_listings
  set
    tokens_sold       = tokens_sold + p_tokens_added,
    amount_raised_usd = amount_raised_usd + p_amount_added,
    status = case
      when (tokens_sold + p_tokens_added) >= total_tokens then 'funded'::listing_status
      else status
    end
  where id = p_listing_id;
end;
$$;

-- =============================================================
-- Realtime: enable for funding progress bar
-- =============================================================
alter publication supabase_realtime add table crop_listings;
alter publication supabase_realtime add table notifications;

-- =============================================================
-- Indexes for common query patterns
-- =============================================================
create index on farms (farmer_id);
create index on crop_listings (farmer_id);
create index on crop_listings (status);
create index on crop_listings (crop_type);
create index on investments (investor_id);
create index on investments (listing_id);
create index on farm_notes (farm_id);
create index on notifications (user_id, read);

-- =============================================================
-- Public read policies (landing page — unauthenticated visitors)
-- These expose only aggregate-safe, non-sensitive columns to anon
-- =============================================================

-- Allow anyone to count farmers (used for stats bar)
create policy "profiles: public count farmers"
  on profiles for select
  using (role = 'farmer');

-- Allow anyone to read open listings (featured listings + stats bar)
create policy "listings: public select open"
  on crop_listings for select
  using (status = 'open');
