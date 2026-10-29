# Feature 3 + 4: Listings API (CRUD, filters, sorting)

**Criteria:** G4, G5, G6, G8, G14, G16, VG1 (API part for each). The pages come later in features 9 and 10.

## What

Five routes on `/listings`. Reading is open to everyone. Writing needs a logged-in user, and only the owner can change or delete a listing.

| Method | Path | Auth | Body / query | Success |
|---|---|---|---|---|
| GET | `/listings` | – | `?location=&maxPrice=&guests=&sort=` | **200** `Listing[]` |
| GET | `/listings/:id` | – | – | **200** `Listing` |
| POST | `/listings` | `requireUser` | `{ title, description?, location, price_per_night, max_guests }` | **201** `Listing` |
| PATCH | `/listings/:id` | `requireUser` | any subset of the create fields (at least one) | **200** `Listing` |
| DELETE | `/listings/:id` | `requireUser` | – | **204** |

`Listing` is the DB row type `Tables<'listings'>` from the generated types (G16), so the API and the DB can't drift apart. JSON keys use the DB's snake_case names, so nothing has to be renamed.

### Filters and sorting (G5, G8)

All are optional and can be combined. They're validated with Zod and **run in the database query** (`.ilike`, `.lte`, `.gte`, `.order`), not in JS after fetching.

| Param | Meaning | Query |
|---|---|---|
| `location` | text, part of the name, case-insensitive (`stock` matches `Stockholm`) | `location ilike %value%` |
| `maxPrice` | whole number ≥ 1 | `price_per_night <= maxPrice` |
| `guests` | whole number ≥ 1 | `max_guests >= guests` (the listing fits that many) |
| `sort` | `price_asc` or `price_desc` | `order by price_per_night`. Without it: newest first (`created_at desc`) |

## Rules and where they live

| Rule | API | DB (already built, feature 2) | Why both |
|---|---|---|---|
| Only logged-in users write (G6) | `requireUser` → 401 | no insert/update/delete grant for `anon` | G6 says API **and** DB. A direct call with the publishable key is still stopped |
| Only the owner updates/deletes (VG1) | 0 rows changed → look the listing up: it exists → **403**, it doesn't → **404** | update/delete policies `owner_id = auth.uid()` | The DB is the real guard. The API only explains *why* nothing happened |
| Owner is the logged-in user | Zod strips any `owner_id` in the body | `owner_id default auth.uid()` + insert policy | A client can't create a listing in someone else's name |
| Valid fields | Zod → 400 with field errors | CHECK constraints (`23514`) | Clear message first; the DB catches anything that slips past |
| Can't delete a listing with a started booking | maps `23514` on delete → **409** | `bookings_time` trigger fires on the cascade | Decided earlier (PROJECT.md §2): protects booking history |
| Filters/sort valid | Zod → 400 | – | Only affects the query, no data to protect |

The 403 lookup is safe because listings are public anyway, so saying "it exists" leaks nothing.

### Validation (Zod)

- `title`: string, trimmed, 1–100 chars
- `description`: string, trimmed, max 1000, optional (empty string or null is saved as `null`)
- `location`: string, trimmed, 1–100 chars
- `price_per_night`: integer ≥ 1 (whole kronor, like the DB)
- `max_guests`: integer ≥ 1
- `:id`: must be a uuid, otherwise **404** (an id that can't exist is "not found", and it stops Postgres's `22P02` from becoming a 500)

## Cases

**Must work**
- `GET /listings` logged out → 200, all seeded listings, newest first.
- `?location=stock` → only the two Stockholm listings.
- `?maxPrice=900` → only listings at ≤ 900.
- `?guests=4` → only listings with `max_guests` ≥ 4.
- `?location=stockholm&sort=price_asc` → Stockholm listings, 650 before 950. `sort=price_desc` → the other way round.
- `GET /listings/:id` for an existing listing → 200.
- Log in as anna, `POST /listings` with valid data → 201, `owner_id` = anna.
- POST with `"owner_id": "<erik's id>"` in the body → 201, `owner_id` is still anna.
- `PATCH` anna's new listing (change the price) → 200 with the new price.
- `DELETE` anna's new listing → 204. `GET` it after → 404.

**Must fail**
- `?maxPrice=abc`, `?guests=0` or `?sort=cheapest` → 400.
- `GET /listings/<random uuid>` → 404. `GET /listings/not-a-uuid` → 404.
- `POST /listings` logged out → 401. Same for PATCH and DELETE.
- POST with `price_per_night: 0`, `max_guests: 0`, a missing `title`, or a non-JSON body → 400.
- PATCH with `{}` → 400.
- As anna, PATCH or DELETE erik's "Apartment in Haga" → 403 (and it's unchanged after).
- PATCH/DELETE a random uuid → 404.
- As erik, DELETE "Seaside house" (has the started booking from `seed_past_booking.sql`) → 409.

## How it's tested

A new `# Listings` section in `backend/tests/api.http`, one call per case above, each with a comment giving the expected status. Precondition: `npm run seed` and `supabase/tests/seed_past_booking.sql` have been run. Ids of the seeded listings are picked up from a `GET /listings?location=...` call with `# @name`, so the file doesn't hard-code uuids.

## Notes from building

- All cases above verified: 36 calls, all with the expected status (run with curl, same calls as `backend/tests/api.http`).
- The test file uses VS Code REST Client syntax (`{{name.response.body...}}`), like the auth section. httpyac's CLI doesn't understand it, so run the file in REST Client.
- `notOwnedOrMissing` takes the Supabase client as its own argument: a route behind `requireUser` has a `Context<AuthedEnv>`, which TypeScript won't pass where a `Context<AppEnv>` is expected.
- A non-JSON body and `PATCH {}` give 400 with empty `details`, because the error is about the whole body and not one field. Enough for now; the frontend form only sends JSON.

## Build steps

1. `src/routes/listings.ts`: Zod schemas (create, update = create `.partial()` + at least one field, query, id), the five routes, and the error → status mapping.
2. Mount it in `src/index.ts`: `app.route('/listings', listings)`.
3. Add the calls to `tests/api.http` and run through all the cases.
