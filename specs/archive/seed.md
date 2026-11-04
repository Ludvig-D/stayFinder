# Seed data from scratch

**Built and verified 2026-11-03.**

## What

Clear out all the data and seed users, listings and bookings again with a new, rewritten seed script. No new criteria. It gives a clean, believable demo for the oral exam on 5 Nov, and `backend/tests/api.http` still passes on top of it.

Right now the DB holds 11 users (3 seeded, 8 left over from test runs, plus `test@test.se`), 9 listings and 7 bookings (2 of them started).

## Wipe the data, keep the schema

"Drop the database" here means **delete every row, not the tables**. The migrations (tables, RLS, triggers) stay exactly as they are. Re-running them adds risk the day before submission and gains nothing.

New file `supabase/seed/reset.sql`, run as `postgres` (Supabase SQL editor or MCP):

1. `delete from public.bookings`, with the `bookings_time` trigger switched off inside one transaction. That trigger refuses to delete started bookings (VG5), and that rule must stay in force for everyone else.
2. `delete from auth.users`. This removes **all** users, `test@test.se` and the leftover test users too. Their listings go with them through `on delete cascade`.

**Why SQL and not the seed script:** the seed script only uses the publishable key, so it can't delete auth users or get past the VG5 trigger. That's the point: it has to obey RLS like the app. Only a superuser can do a reset.

## Seed order (3 steps, documented in the backend README)

1. `supabase/seed/reset.sql` (SQL editor): empty DB
2. `npm run seed` (in `backend/`): users, listings, bookings, through the publishable key, so every row passes RLS and the triggers
3. `supabase/seed/past_booking.sql` (SQL editor): the started booking for VG5 (moved from `supabase/tests/seed_past_booking.sql`)

## The seed script (`backend/src/seed.ts`, rewritten)

- Expects an empty DB. Each user is created with `signUp` (Confirm email is off, so they get a session). If a user already exists, the script stops with "run reset.sql first" instead of skipping, so there's never a half-seeded DB.
- One client per user, publishable key, never the service-role key (same as today).
- `total_price` is sent as 0 and set by the `bookings_price` trigger (VG6), same as today.
- Ends by printing what was created and the login details.

## Data

**Kept, because `api.http` depends on them:**

| What | Why |
|---|---|
| anna, erik, sara `@stayfinder.test`, password `password123` | logins in the test file |
| Exactly 2 Stockholm listings, at 650 and 950 | the `location=stock` and sort tests |
| Exactly 1 listing each in Göteborg ("Apartment in Haga", 800, erik), Visby ("Seaside house", erik), Malmö ("Townhouse in Malmö", 1100, max 4, erik, **no bookings**), Åre ("Cabin by the slopes", anna) | the test file picks `$[0]` from `?location=...` |
| sara's started booking on Seaside house | VG5 and the 409 delete test |

**New:**

- 2 more users: **lisa** (guest) and **omar** (host)
- 6 more listings: Kiruna 3200/2, Vaxholm 2600/10, Uppsala 450/1, Öland 1350/5 (omar), Rättvik 980/4 (anna), Lund 700/2 (erik). The Stockholm archipelago listing is called "Vaxholm", so `location=stock` still finds only 2
- 12 bookings in total (11 from the seed script plus the past one), so the demo shows:
  - a guest with bookings on several listings (sara's "My bookings" view)
  - an owner seeing several guests' bookings on one listing (VG1)
  - a cancelled booking plus an active one on overlapping dates (VG2: cancelled doesn't count)
  - back-to-back bookings (check-out day = next check-in day)
  - one booking per owner on another owner's listing

## How it's tested

1. Run the 3 steps. Check the counts with one SQL query (users, listings, bookings, cancelled, started).
2. Run `npm run seed` again on the seeded DB: it must stop with the "run reset.sql first" message and change nothing.
3. Run all of `backend/tests/api.http` top to bottom: every call gives the status in its comment.
4. Click-through: log in as anna, erik and sara and check the list, the filters, a detail page and the bookings each one sees.

## Decided

- Delete **all** users, including `test@test.se` and the leftover test users.
- The amount is right: lisa and omar, about 6 extra listings, about 10 bookings in total.

## How it went

- Built as specced: `supabase/seed/reset.sql`, the rewritten `backend/src/seed.ts`, and `supabase/tests/seed_past_booking.sql` moved to `supabase/seed/past_booking.sql`. The seeding steps are documented in `backend/README.md`.
- After seeding there are 5 users, 12 listings and 12 bookings (1 cancelled, 1 started). The past booking's price, 5400, was computed by the trigger.
- Running `npm run seed` a second time stops at anna with "User already registered ... run supabase/seed/reset.sql first", and nothing is changed.
- `api.http`: all 108 calls give the status in their comment. httpyac can't run the file because it doesn't support REST Client's `{{name.response.body...}}` syntax, so the calls were run with a small REST Client-style script. The data-dependent responses were also checked by hand: 2 Stockholm listings in price order, exactly 1 listing per test location, sara's 2 bookings on Seaside house, erik seeing 3 guests on Seaside house, and the cancelled and active bookings that overlap on Södermalm.
- Click-through in a headless browser (14 checks): the listing list, the "stock" filter, a detail page logged out, and the bookings shown to sara, erik, anna and lisa.
- `api.http` registers a new `user<timestamp>@stayfinder.test` on every run, so the 3 test-run users were deleted afterwards.
