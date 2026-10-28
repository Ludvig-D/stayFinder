-- Feature 2: listings table + RLS (G6, G15, VG1)

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null,
  description text,
  location text not null,
  price_per_night integer not null check (price_per_night > 0),
  max_guests integer not null check (max_guests >= 1),
  created_at timestamptz not null default now()
);

-- Without policies, nobody gets any rows. The policies below open up exactly what's allowed.
alter table public.listings enable row level security;

-- Grants decide which roles can touch the table at all; RLS decides which rows.
-- Start from nothing so we don't depend on Supabase's default grants.
revoke all on public.listings from anon, authenticated;
grant select on public.listings to anon, authenticated;
grant insert, update, delete on public.listings to authenticated;

-- (select auth.uid()) instead of auth.uid(): Postgres evaluates it once per query instead of once per row.

create policy "Anyone can read listings"
  on public.listings for select
  to anon, authenticated
  using (true);

create policy "Logged-in users can create listings they own"
  on public.listings for insert
  to authenticated
  with check (owner_id = (select auth.uid()));

-- using: which rows the owner may change. with check: the row after the change must still be theirs.
create policy "Owners can update their listings"
  on public.listings for update
  to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

create policy "Owners can delete their listings"
  on public.listings for delete
  to authenticated
  using (owner_id = (select auth.uid()));
