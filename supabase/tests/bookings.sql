-- Feature 6: bookings RLS + DB rules tests (G10, G15, VG1, VG2, VG3, VG5, VG6). See specs/archive/bookings-db.md.
-- Run the whole file in the SQL Editor (as postgres).
-- Everything happens in one transaction that is rolled back, so nothing is left behind.
-- A failing case stops the script with "FAIL: ...". If it runs to the end, every case passed.
--
-- Acting as a user: `set local role` picks the Postgres role (anon / authenticated),
-- and request.jwt.claims is what auth.uid() reads the user id from.
-- Dates are relative to "today" in Swedish time, the same as the bookings_time trigger.

begin;

-- Three throwaway users: A owns the listing, B and C are guests.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'test-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'test-b@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'test-c@example.com');


---------- Act as A ----------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- A's listing: max 4 guests, 1000 per night
insert into public.listings (id, title, location, price_per_night, max_guests)
values ('00000000-0000-0000-0000-0000000000a1', 'A''s cabin', 'Åre', 1000, 4);


---------- Act as B ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

-- MUST WORK: B books A's listing for 3 nights and sends total_price = 1.
-- The bookings_price trigger ignores it and stores 3 * 1000 (VG6).
do $$
declare
  today date := (now() at time zone 'Europe/Stockholm')::date;
  price integer;
begin
  insert into public.bookings (id, listing_id, email, check_in, check_out, guests, total_price)
  values ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000a1',
          'b@example.com', today + 10, today + 13, 2, 1)
  returning total_price into price;

  if price <> 3000 then
    raise exception 'FAIL: total_price is %, expected 3000', price;
  end if;
end $$;

-- MUST WORK: B moves the booking one day, overlapping its own old dates.
-- The exclusion constraint compares against the other rows, so it doesn't clash with itself (VG2).
do $$
declare
  today date := (now() at time zone 'Europe/Stockholm')::date;
  affected integer;
begin
  update public.bookings set check_in = today + 11, check_out = today + 14
  where id = '00000000-0000-0000-0000-0000000000b1';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'FAIL: B could not edit their own booking onto its own dates';
  end if;
end $$;

-- MUST WORK: check-in today is allowed. Only dates before today count as passed (VG5).
do $$
declare
  today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  insert into public.bookings (id, listing_id, email, check_in, check_out, guests, total_price)
  values ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000a1',
          'b@example.com', today, today + 1, 1, 0);
end $$;

-- MUST FAIL: guests = 0 and check_out = check_in (CHECK constraints) -> 23514 (G10)
do $$
declare
  today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  insert into public.bookings (listing_id, email, check_in, check_out, guests, total_price)
  values ('00000000-0000-0000-0000-0000000000a1', 'b@example.com', today + 30, today + 32, 0, 0);
  raise exception 'FAIL: guests = 0 was accepted';
exception
  when check_violation then null; -- expected
end $$;

do $$
declare
  today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  insert into public.bookings (listing_id, email, check_in, check_out, guests, total_price)
  values ('00000000-0000-0000-0000-0000000000a1', 'b@example.com', today + 30, today + 30, 1, 0);
  raise exception 'FAIL: check_out = check_in was accepted';
exception
  when check_violation then null; -- expected
end $$;

-- MUST FAIL: 5 guests on a listing with max 4, on create and on edit (bookings_capacity) -> 23514 (VG3)
do $$
declare
  today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  insert into public.bookings (listing_id, email, check_in, check_out, guests, total_price)
  values ('00000000-0000-0000-0000-0000000000a1', 'b@example.com', today + 30, today + 32, 5, 0);
  raise exception 'FAIL: 5 guests were accepted on a max-4 listing';
exception
  when check_violation then null; -- expected
end $$;

do $$
begin
  update public.bookings set guests = 5
  where id = '00000000-0000-0000-0000-0000000000b1';
  raise exception 'FAIL: B could edit guests to 5 on a max-4 listing';
exception
  when check_violation then null; -- expected
end $$;

-- MUST FAIL: check-in yesterday (bookings_time) -> 23514 (VG5)
do $$
declare
  today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  insert into public.bookings (listing_id, email, check_in, check_out, guests, total_price)
  values ('00000000-0000-0000-0000-0000000000a1', 'b@example.com', today - 1, today + 2, 1, 0);
  raise exception 'FAIL: a check-in in the past was accepted';
exception
  when check_violation then null; -- expected
end $$;

-- MUST FAIL: B writes total_price or guest_id. Not in the column grant -> 42501 (VG6, VG1)
do $$
begin
  update public.bookings set total_price = 1
  where id = '00000000-0000-0000-0000-0000000000b1';
  raise exception 'FAIL: B could set total_price';
exception
  when insufficient_privilege then null; -- expected
end $$;

do $$
begin
  update public.bookings set guest_id = '00000000-0000-0000-0000-00000000000c'
  where id = '00000000-0000-0000-0000-0000000000b1';
  raise exception 'FAIL: B could hand the booking over to C';
exception
  when insufficient_privilege then null; -- expected
end $$;


---------- Act as C ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

-- MUST WORK: C checks in on the day B checks out. '[)' leaves the check-out day free (VG2).
do $$
declare
  today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  insert into public.bookings (id, listing_id, email, check_in, check_out, guests, total_price)
  values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000a1',
          'c@example.com', today + 14, today + 16, 1, 0);
end $$;

-- MUST FAIL: C books dates that overlap B's active booking (bookings_no_overlap) -> 23P01 (VG2)
do $$
declare
  today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  insert into public.bookings (listing_id, email, check_in, check_out, guests, total_price)
  values ('00000000-0000-0000-0000-0000000000a1', 'c@example.com', today + 12, today + 15, 1, 0);
  raise exception 'FAIL: an overlapping booking was accepted';
exception
  when exclusion_violation then null; -- expected
end $$;

-- MUST WORK: C sees only their own bookings, not B's (VG1)
do $$
begin
  if (select count(*) from public.bookings where guest_id <> '00000000-0000-0000-0000-00000000000c') <> 0 then
    raise exception 'FAIL: C can see other guests'' bookings';
  end if;
end $$;

-- MUST FAIL: C updates B's booking. RLS hides the row: no error, 0 rows affected (VG1)
do $$
declare
  affected integer;
begin
  update public.bookings set guests = 1
  where id = '00000000-0000-0000-0000-0000000000b1';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: C updated B''s booking';
  end if;
end $$;


---------- Act as B again ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

-- MUST FAIL: B edits their booking so it runs into C's dates -> 23P01 (VG2, on edit)
do $$
declare
  today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  update public.bookings set check_out = today + 15
  where id = '00000000-0000-0000-0000-0000000000b1';
  raise exception 'FAIL: B could edit their booking into C''s dates';
exception
  when exclusion_violation then null; -- expected
end $$;


---------- Act as A (the listing owner) ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- MUST WORK: the owner sees every booking on their listing: B's two and C's one (VG1)
do $$
begin
  if (select count(*) from public.bookings where listing_id = '00000000-0000-0000-0000-0000000000a1') <> 3 then
    raise exception 'FAIL: the owner can''t see all bookings on their listing';
  end if;
end $$;

-- MUST FAIL: A books their own listing (insert policy) -> 42501
do $$
declare
  today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  insert into public.bookings (listing_id, email, check_in, check_out, guests, total_price)
  values ('00000000-0000-0000-0000-0000000000a1', 'a@example.com', today + 50, today + 52, 1, 0);
  raise exception 'FAIL: A could book their own listing';
exception
  when insufficient_privilege then null; -- expected
end $$;

-- MUST FAIL: the owner updates / deletes B's booking. The owner can only read: 0 rows affected (VG1)
do $$
declare
  affected integer;
begin
  update public.bookings set guests = 1
  where id = '00000000-0000-0000-0000-0000000000b1';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: the owner updated B''s booking';
  end if;

  delete from public.bookings
  where id = '00000000-0000-0000-0000-0000000000b1';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: the owner deleted B''s booking';
  end if;
end $$;

-- MUST WORK: the owner doubles the price. C's existing booking keeps its saved price, 2 * 1000 (VG6)
do $$
begin
  update public.listings set price_per_night = 2000
  where id = '00000000-0000-0000-0000-0000000000a1';

  if (select total_price from public.bookings where id = '00000000-0000-0000-0000-0000000000c1') <> 2000 then
    raise exception 'FAIL: a price change on the listing changed an existing booking';
  end if;
end $$;


---------- Act as a logged-out visitor ----------
reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

-- MUST FAIL: anon creates a booking (no grant to anon) -> 42501 (G15)
do $$
declare
  today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  insert into public.bookings (listing_id, email, check_in, check_out, guests, total_price)
  values ('00000000-0000-0000-0000-0000000000a1', 'anon@example.com', today + 60, today + 62, 1, 0);
  raise exception 'FAIL: anon could create a booking';
exception
  when insufficient_privilege then null; -- expected
end $$;


---------- Act as B: cancel ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

-- MUST WORK: B cancels their booking
do $$
declare
  affected integer;
begin
  update public.bookings set status = 'cancelled'
  where id = '00000000-0000-0000-0000-0000000000b1';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'FAIL: B could not cancel their own booking';
  end if;
end $$;


---------- Act as C ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000c", "role": "authenticated"}';

-- MUST WORK: C books dates that overlap B's CANCELLED booking. Cancelled rows don't count (VG2)
do $$
declare
  today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  insert into public.bookings (listing_id, email, check_in, check_out, guests, total_price)
  values ('00000000-0000-0000-0000-0000000000a1', 'c@example.com', today + 11, today + 13, 1, 0);
end $$;


---------- Act as B ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

-- MUST FAIL: B re-activates the cancelled booking, but C has those dates now -> 23P01 (VG2)
do $$
begin
  update public.bookings set status = 'active'
  where id = '00000000-0000-0000-0000-0000000000b1';
  raise exception 'FAIL: a cancelled booking was re-activated onto taken dates';
exception
  when exclusion_violation then null; -- expected
end $$;


---------- A booking whose check-in has passed (VG5) ----------
-- Our own rules won't let anyone create one, so insert it as postgres with bookings_time off
-- (same trick as seed_past_booking.sql).
reset role;

alter table public.bookings disable trigger bookings_time;

insert into public.bookings (id, listing_id, guest_id, email, check_in, check_out, guests, total_price)
values ('00000000-0000-0000-0000-0000000000b9', '00000000-0000-0000-0000-0000000000a1',
        '00000000-0000-0000-0000-00000000000b', 'b@example.com',
        (now() at time zone 'Europe/Stockholm')::date - 5,
        (now() at time zone 'Europe/Stockholm')::date - 2, 1, 0);

alter table public.bookings enable trigger bookings_time;


---------- Act as B ----------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

-- MUST FAIL: B edits, moves, cancels or deletes the booking that has started (bookings_time) -> 23514 (VG5)
do $$
begin
  update public.bookings set guests = 2
  where id = '00000000-0000-0000-0000-0000000000b9';
  raise exception 'FAIL: B could edit a booking that has started';
exception
  when check_violation then null; -- expected
end $$;

do $$
declare
  today date := (now() at time zone 'Europe/Stockholm')::date;
begin
  update public.bookings set check_in = today + 70, check_out = today + 72
  where id = '00000000-0000-0000-0000-0000000000b9';
  raise exception 'FAIL: B could move a booking that has started to future dates';
exception
  when check_violation then null; -- expected
end $$;

do $$
begin
  update public.bookings set status = 'cancelled'
  where id = '00000000-0000-0000-0000-0000000000b9';
  raise exception 'FAIL: B could cancel a booking that has started';
exception
  when check_violation then null; -- expected
end $$;

do $$
begin
  delete from public.bookings
  where id = '00000000-0000-0000-0000-0000000000b9';
  raise exception 'FAIL: B could delete a booking that has started';
exception
  when check_violation then null; -- expected
end $$;


---------- Act as A ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- MUST FAIL: A deletes the listing. The cascade would delete the started booking,
-- so bookings_time blocks the whole delete -> 23514. Kept on purpose: history is protected (API: 409).
do $$
begin
  delete from public.listings
  where id = '00000000-0000-0000-0000-0000000000a1';
  raise exception 'FAIL: a listing with a started booking could be deleted';
exception
  when check_violation then null; -- expected
end $$;


reset role;
select 'All bookings tests passed' as result;

rollback;
