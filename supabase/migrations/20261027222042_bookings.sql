-- Feature 6: bookings table + RLS (G10, G15, VG1, VG2)

-- Lets a GiST index compare plain values (listing_id with =) next to ranges (&&).
create extension if not exists btree_gist with schema extensions;

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  guest_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email text not null,
  check_in date not null,
  check_out date not null,
  guests integer not null check (guests >= 1),
  total_price integer not null, -- set by the bookings_price trigger (VG6)
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_at timestamptz not null default now(),

  -- G10
  constraint bookings_dates_check check (check_out > check_in),

  -- VG2: no two non-cancelled bookings of the same listing may have overlapping dates.
  -- '[)' includes check_in but not check_out, so one guest can check in the day another checks out.
  constraint bookings_no_overlap exclude using gist (
    listing_id with =,
    daterange(check_in, check_out, '[)') with &&
  ) where (status <> 'cancelled')
);

alter table public.bookings enable row level security;

-- Only logged-in users touch bookings. On update, only these columns can change:
-- a booking can't be moved to another listing or guest, and the client can never write total_price.
revoke all on public.bookings from anon, authenticated;
grant select, insert, delete on public.bookings to authenticated;
grant update (email, check_in, check_out, guests, status) on public.bookings to authenticated;

-- VG1: the guest sees their own bookings, the listing owner sees all bookings for their listing.
create policy "Guests and listing owners can read bookings"
  on public.bookings for select
  to authenticated
  using (
    guest_id = (select auth.uid())
    or exists (
      select 1 from public.listings
      where listings.id = bookings.listing_id
        and listings.owner_id = (select auth.uid())
    )
  );

-- A booking is always made as yourself, and never on your own listing.
create policy "Guests can book other people's listings"
  on public.bookings for insert
  to authenticated
  with check (
    guest_id = (select auth.uid())
    and not exists (
      select 1 from public.listings
      where listings.id = bookings.listing_id
        and listings.owner_id = (select auth.uid())
    )
  );

-- Only the guest edits/cancels or deletes. The listing owner can only read (no VG4).
create policy "Guests can update their bookings"
  on public.bookings for update
  to authenticated
  using (guest_id = (select auth.uid()))
  with check (guest_id = (select auth.uid()));

create policy "Guests can delete their bookings"
  on public.bookings for delete
  to authenticated
  using (guest_id = (select auth.uid()));
