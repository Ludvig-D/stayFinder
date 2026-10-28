-- Feature 2: listings RLS tests (G6, G15, VG1). See specs/listings-db.md.
-- Run the whole file in the SQL Editor (as postgres).
-- Everything happens in one transaction that is rolled back, so nothing is left behind.
-- A failing case stops the script with "FAIL: ...". If it runs to the end, every case passed.
--
-- Acting as a user: `set local role` picks the Postgres role (anon / authenticated),
-- and request.jwt.claims is what auth.uid() reads the user id from.

begin;

-- Two throwaway users: A owns the listing, B is someone else.
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'test-a@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'test-b@example.com');


---------- Act as A ----------
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- MUST WORK: A creates a listing, owner_id is filled in automatically
do $$
declare
  new_owner uuid;
begin
  insert into public.listings (id, title, location, price_per_night, max_guests)
  values ('00000000-0000-0000-0000-0000000000a1', 'A''s cabin', 'Åre', 900, 4)
  returning owner_id into new_owner;

  if new_owner is distinct from '00000000-0000-0000-0000-00000000000a' then
    raise exception 'FAIL: owner_id was not set to A';
  end if;
end $$;

-- MUST FAIL: A creates a listing owned by B (RLS with check) -> 42501
do $$
begin
  insert into public.listings (title, location, price_per_night, max_guests, owner_id)
  values ('Fake', 'Nowhere', 500, 2, '00000000-0000-0000-0000-00000000000b');
  raise exception 'FAIL: A could create a listing owned by B';
exception
  when insufficient_privilege then null; -- expected
end $$;

-- MUST FAIL: price 0 and max_guests 0 (CHECK constraints) -> 23514
do $$
begin
  insert into public.listings (title, location, price_per_night, max_guests)
  values ('Free', 'Nowhere', 0, 2);
  raise exception 'FAIL: price_per_night = 0 was accepted';
exception
  when check_violation then null; -- expected
end $$;

do $$
begin
  insert into public.listings (title, location, price_per_night, max_guests)
  values ('Empty', 'Nowhere', 500, 0);
  raise exception 'FAIL: max_guests = 0 was accepted';
exception
  when check_violation then null; -- expected
end $$;


---------- Act as a logged-out visitor ----------
reset role;
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

-- MUST WORK: anon can read listings
do $$
begin
  if (select count(*) from public.listings) <> 1 then
    raise exception 'FAIL: anon could not see A''s listing';
  end if;
end $$;

-- MUST FAIL: anon creates a listing (no insert grant) -> 42501
do $$
begin
  insert into public.listings (title, location, price_per_night, max_guests)
  values ('Anon', 'Nowhere', 500, 2);
  raise exception 'FAIL: anon could create a listing';
exception
  when insufficient_privilege then null; -- expected
end $$;


---------- Act as B ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000b", "role": "authenticated"}';

-- MUST FAIL: B updates / deletes A's listing. RLS hides the row: no error, 0 rows affected.
do $$
declare
  affected integer;
begin
  update public.listings set title = 'Hacked'
  where id = '00000000-0000-0000-0000-0000000000a1';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: B updated A''s listing';
  end if;

  delete from public.listings
  where id = '00000000-0000-0000-0000-0000000000a1';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'FAIL: B deleted A''s listing';
  end if;
end $$;


---------- Act as A again ----------
reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "00000000-0000-0000-0000-00000000000a", "role": "authenticated"}';

-- MUST FAIL: A gives the listing to B (update with check) -> 42501
do $$
begin
  update public.listings set owner_id = '00000000-0000-0000-0000-00000000000b'
  where id = '00000000-0000-0000-0000-0000000000a1';
  raise exception 'FAIL: A could hand the listing over to B';
exception
  when insufficient_privilege then null; -- expected
end $$;

-- MUST WORK: A updates and then deletes their own listing
do $$
declare
  affected integer;
begin
  update public.listings set price_per_night = 1000
  where id = '00000000-0000-0000-0000-0000000000a1';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'FAIL: A could not update their own listing';
  end if;

  delete from public.listings
  where id = '00000000-0000-0000-0000-0000000000a1';
  get diagnostics affected = row_count;
  if affected <> 1 then
    raise exception 'FAIL: A could not delete their own listing';
  end if;
end $$;


reset role;
select 'All listings tests passed' as result;

rollback;
