-- Step 3 of 3 of seeding: VG5 test data, a booking whose check-in has already passed.
-- Run in the Supabase SQL editor (as postgres), after reset.sql and `npm run seed` (in backend/).
-- Our own rules won't let anyone create one, so we insert it as postgres
-- with only the bookings_time trigger switched off, inside one transaction.
-- The other triggers still run, so the price is still computed by the database.

begin;

alter table public.bookings disable trigger bookings_time;

insert into public.bookings (listing_id, guest_id, email, check_in, check_out, guests, total_price)
select listings.id, users.id, users.email, current_date - 10, current_date - 7, 2, 0
from public.listings, auth.users as users
where listings.title = 'Seaside house'
  and users.email = 'sara@stayfinder.test';

alter table public.bookings enable trigger bookings_time;

commit;
