-- Step 1 of 3 of seeding: empty the database. Run in the Supabase SQL editor (as postgres).
-- Then: `npm run seed` (in backend/), then supabase/seed/past_booking.sql.
--
-- Deletes every row, not the tables: migrations, RLS and triggers stay as they are.
-- This has to be SQL run as postgres. The seed script only has the publishable key,
-- so it can't delete auth users or get past the bookings_time trigger, and that's on purpose.

begin;

-- bookings_time refuses to delete a booking whose check-in has passed (VG5).
-- Switched off only inside this transaction, so the rule is back in force for everyone else afterwards.
alter table public.bookings disable trigger bookings_time;
delete from public.bookings;
alter table public.bookings enable trigger bookings_time;

-- All users. Their listings go with them (listings.owner_id ... on delete cascade).
delete from auth.users;

commit;
