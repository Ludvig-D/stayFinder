# Feature 2: Listings table + RLS

**Criteria:** G6, G15, VG1 (listings part)

## What

A `public.listings` table that anyone can read, but where only logged-in users can create rows and only the owner can change or delete their own.

| column | type | rule |
|---|---|---|
| `id` | uuid PK | `default gen_random_uuid()` |
| `owner_id` | uuid → `auth.users(id)` | `not null default auth.uid()`, `on delete cascade` |
| `title` | text | not null |
| `description` | text | nullable |
| `location` | text | not null |
| `price_per_night` | integer | not null, `check (price_per_night > 0)` (whole kronor) |
| `max_guests` | integer | not null, `check (max_guests >= 1)` |
| `created_at` | timestamptz | `not null default now()` |

## Rules and where they live

| Rule | DB | API (feature 3) | Why in the DB |
|---|---|---|---|
| Anyone can read | grant `select` to `anon`, `authenticated` + select policy `using (true)` | – | – |
| Only logged in can create | grant `insert` only to `authenticated` + insert policy `with check (owner_id = auth.uid())` | 401 if no user | G6 says API **and** DB. Stops a direct call with the publishable key |
| Only the owner updates/deletes | update policy `using` + `with check (owner_id = auth.uid())`, delete policy `using (owner_id = auth.uid())` | 403/404 | VG1: the DB must guarantee ownership |
| Valid price/guests | CHECK constraints | Zod → 400 | Bad data can't get in, whatever the client is |

`with check` on update stops an owner from handing the listing to someone else by changing `owner_id`.

## Cases

Tested now in the SQL Editor (acting as users A and B), and later again as API calls in feature 3.

**Must work**
- `anon` can select all listings.
- User A inserts a listing. `owner_id` becomes A automatically.
- A updates and deletes their own listing.

**Must fail**
- `anon` inserts → `permission denied` (no grant) → API 401.
- A inserts with `owner_id = B` → RLS error `42501` → API 403.
- B updates/deletes A's listing → **0 rows affected, no error.** RLS hides the row. The API has to turn "0 rows" into 404 (feature 3).
- `price_per_night = 0` or `max_guests = 0` → `23514` check_violation → API 400.

## Build steps

1. Create two test users in the dashboard (Authentication → Users → Add user): **A** and **B**. Note their uuids.
2. Write `supabase/migrations/<YYYYMMDDHHMMSS>_listings.sql`:
   1. `create table` with the columns and checks above
   2. `alter table ... enable row level security`
   3. `grant` (select to anon + authenticated; insert/update/delete to authenticated)
   4. the 4 policies (select, insert, update, delete), each with `to <role>`
3. Run the file in the SQL Editor.
4. Verify with the cases above (save the test SQL in `supabase/tests/listings.sql`).
5. Generate types: `npx supabase gen types typescript --project-id <id> > src/types/database.types.ts` (in `backend/`).
