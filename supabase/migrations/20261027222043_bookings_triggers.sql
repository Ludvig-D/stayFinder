-- Feature 6: booking rules that need another table or "today" (VG3, VG5, VG6).
-- A CHECK constraint can only look at its own row, so these are BEFORE triggers.
-- They raise with errcode check_violation (23514), which the API maps to 400.
-- BEFORE triggers on the same table run in alphabetical order by trigger name; these don't depend on each other.

-- VG3: guests can't exceed the listing's max_guests, read from the database, not from the client.
create or replace function public.check_booking_capacity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  listing_max_guests integer;
begin
  select max_guests into listing_max_guests
  from public.listings
  where id = new.listing_id;

  if new.guests > listing_max_guests then
    raise exception 'This listing allows at most % guests', listing_max_guests
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger bookings_capacity
  before insert or update of guests on public.bookings
  for each row execute function public.check_booking_capacity();


-- VG6: total_price = nights * the listing's price, overwriting whatever the client sent.
-- It's stored on the booking, so a later change to the listing's price doesn't affect it.
create or replace function public.set_booking_price()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  listing_price integer;
begin
  select price_per_night into listing_price
  from public.listings
  where id = new.listing_id;

  if not found then
    raise exception 'Listing not found'
      using errcode = 'foreign_key_violation';
  end if;

  -- date - date gives the number of days, i.e. nights
  new.total_price := (new.check_out - new.check_in) * listing_price;

  return new;
end;
$$;

create trigger bookings_price
  before insert or update of check_in, check_out on public.bookings
  for each row execute function public.set_booking_price();


-- VG5: check-in can't be in the past, and a booking whose check-in has passed
-- can't be edited, cancelled (an update) or deleted.
-- "Today" is Swedish time; the database itself runs in UTC.
create or replace function public.check_booking_not_started()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  if tg_op in ('UPDATE', 'DELETE') and old.check_in < today then
    raise exception 'This booking has already started and can no longer be changed'
      using errcode = 'check_violation';
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.check_in < today then
    raise exception 'Check-in date has already passed'
      using errcode = 'check_violation';
  end if;

  -- For DELETE, NEW is null; returning it would silently skip the delete.
  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger bookings_time
  before insert or update or delete on public.bookings
  for each row execute function public.check_booking_not_started();
