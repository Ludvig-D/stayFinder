# Feature 6: Bookings table + RLS + DB rules

**Criteria:** G10, G15, VG1, VG2, VG3, VG5, VG6

## What

A `public.bookings` table. A booking belongs to the guest who made it. The guest sees, edits, cancels and deletes their own bookings. The listing owner can only **see** the bookings for their listing (no VG4).

| column | type | rule |
|---|---|---|
| `id` | uuid PK | `default gen_random_uuid()` |
| `listing_id` | uuid → `listings(id)` | not null, `on delete cascade` |
| `guest_id` | uuid → `auth.users(id)` | `not null default auth.uid()` |
| `email` | text | not null (format checked by Zod) |
| `check_in`, `check_out` | date | not null, `check (check_out > check_in)` |
| `guests` | integer | not null, `check (guests >= 1)` |
| `total_price` | integer | not null, **set by trigger** |
| `status` | text | not null, default `'active'`, `check (status in ('active','cancelled'))` |
| `created_at` | timestamptz | `not null default now()` |

**Today** = `(now() at time zone 'Europe/Stockholm')::date` (the DB runs in UTC).

## Rules and where they live

| Rule | DB | Error → API |
|---|---|---|
| G10 valid data | CHECK constraints (+ Zod in the API first) | `23514` → 400 |
| VG1 who sees what | select policy: `guest_id = auth.uid()` OR owns the listing | hidden → 404 |
| VG1 only the guest changes | update/delete policies: `guest_id = auth.uid()` | 0 rows → 404 |
| Can't book own listing | insert policy: `not exists (listing where owner_id = auth.uid())` | `42501` → 403 |
| Only some fields editable | column grant: `update (email, check_in, check_out, guests, status)`. `listing_id`, `guest_id`, `total_price` can't be changed | `42501` → 400 (API never sends them) |
| VG2 no overlap | `exclude using gist (listing_id with =, daterange(check_in, check_out, '[)') with &&) where (status <> 'cancelled')` (needs `btree_gist`) | `23P01` → 409 |
| VG3 capacity | trigger `bookings_capacity`: `before insert or update of guests` compares with the listing's `max_guests` | `23514` → 400 |
| VG5 time | trigger `bookings_time`: `before insert or update or delete`. Rejects `NEW.check_in < today` (insert/update) and `OLD.check_in < today` (update/delete) | `23514` → 400 |
| VG6 price | trigger `bookings_price`: `before insert or update of check_in, check_out` sets `total_price = nights * price_per_night` | – (client value ignored) |

Why the DB and not only the API: VG rules must hold even when someone calls Supabase directly with the publishable key. VG3 and VG6 read the listing **in the DB**, so the client can't fake `max_guests` or the price. Triggers rather than CHECK, because a CHECK can't read another table (VG3/VG6) or use "today" (VG5).

`'[)'` = check-out day is free for the next guest's check-in. An edited booking never clashes with itself (the constraint compares against the other rows).

Cancel = `update status = 'cancelled'`. Delete = remove the row. Both are blocked once check-in has passed.

## Cases

**Must work**
- B books A's listing, 2 guests, future dates. `total_price` = nights × price.
- The same booking with `total_price = 1` sent → still the correct price.
- B edits their own booking's dates, overlapping its old dates → OK.
- New booking starting on another booking's check-out day → OK.
- Booking dates that overlap a **cancelled** booking → OK.
- A (owner) sees B's booking. B sees only their own.

**Must fail**
- `guests = 0`, `check_out <= check_in` → 400
- `guests > max_guests` → 400 (VG3)
- `check_in` yesterday → 400 (VG5)
- Overlapping an active booking (create or edit) → 409 (VG2)
- A books their own listing → 403
- A (owner) updates/deletes B's booking → 0 rows → 404
- Edit/cancel/delete a booking whose check-in has passed → 400 (VG5)

## Build steps

1. Migration `supabase/migrations/<timestamp>_bookings.sql`: `create extension if not exists btree_gist`, table + checks + exclusion constraint, RLS on, grants (to `authenticated` only), 4 policies.
2. Migration `<timestamp>_bookings_triggers.sql`: 3 trigger functions + 3 triggers.
3. Run them, verify the cases in the SQL Editor (`supabase/tests/bookings.sql`), regenerate types.
4. **VG5 test data:** a booking in the past can't be created through the rules. Insert it as `postgres` with `bookings_time` disabled inside a transaction (`alter table bookings disable trigger bookings_time; insert ...; alter table bookings enable trigger bookings_time;`), and keep that SQL in `supabase/tests/seed_past_booking.sql`.

## Found during testing (2026-10-28)

All cases above pass (`supabase/tests/bookings.sql`). Two side effects that weren't in the plan:

- **Reactivating a cancelled booking** (`status` → `'active'`) whose dates have since been taken → `23P01`. Correct: the exclusion constraint applies again once the row is no longer cancelled. If the API ever allows un-cancelling, map it to 409 like any overlap.
- **Deleting a listing that has a started booking is blocked.** The cascade delete fires `bookings_time` on each booking, so the whole delete fails with `23514` ("This booking has already started…"). **Decision: keep it**: a booking that has started is history and must not disappear. The listings API maps this to **409** with a clear message (see the listings API spec).
