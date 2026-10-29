# Feature 7: Bookings API (create, list, edit, cancel, delete)

**Criteria:** G9, G10, G12, G14, plus the API side of VG1, VG2, VG3, VG5, VG6. The rules themselves are already in the DB (feature 6, `specs/archive/bookings-db.md`); this feature validates input and turns DB errors into clear status codes. The form and list come in feature 11.

## What

All routes need a logged-in user (`requireUser` → 401). Bookings are created and listed **under a listing** (G12 says "bookings for a listing"), and edited/deleted by their own id.

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/listings/:id/bookings` | – | **200** `Booking[]`: what RLS lets you see (guest: own, owner: all), check-in order, cancelled included |
| POST | `/listings/:id/bookings` | `{ email, check_in, check_out, guests }` | **201** `Booking` |
| PATCH | `/bookings/:id` | any subset of `{ email, check_in, check_out, guests }`, or `{ status: 'cancelled' }` | **200** `Booking` |
| DELETE | `/bookings/:id` | – | **204** |

`Booking` = `Tables<'bookings'>` (G16). Cancel is a PATCH with `status: 'cancelled'`. Delete removes the row.

## Rules and where they live

| Rule | API | DB (feature 6) | Status |
|---|---|---|---|
| Logged in | `requireUser` | no grants for `anon` | 401 |
| Valid data (G10) | Zod, field errors | CHECK constraints `23514` | 400 |
| Can't book own listing | – | insert policy `42501` | 403 |
| Listing doesn't exist (POST) | – | `bookings_price` raises `23503` | 404 |
| Only the guest edits/deletes (VG1) | 0 rows → look the booking up: visible (you're the listing owner) → **403**, not visible → **404** | update/delete policies | 403 / 404 |
| Who sees what (VG1) | just selects, no filter on `guest_id` | select policy | 200 |
| No overlap (VG2) | – | exclusion constraint `23P01` | **409** |
| Capacity (VG3) | – | `bookings_capacity` `23514` | 400 |
| Past check-in / started booking (VG5) | – | `bookings_time` `23514` | 400 |
| Price (VG6) | Zod drops `total_price` | `bookings_price` overwrites it | – |

Why VG2/3/5 are **not** also checked in Zod: they need the listing's data, other bookings or "today in Stockholm", which only the DB has reliably. Checking twice would mean two copies of the rule that can drift. The API passes on the trigger's own message (e.g. "This listing allows at most 4 guests") so the form can show it.

Why 404 instead of 403 for someone else's booking you can't see: unlike listings, bookings are private, so saying "it exists" would leak.

### Validation (Zod)

- `email`: `z.email()`
- `check_in`, `check_out`: `z.iso.date()` (`YYYY-MM-DD`). If both are sent: `check_out > check_in` (refine on `check_out`)
- `guests`: integer ≥ 1
- PATCH: at least one field; `status` only accepts `'cancelled'` (no un-cancel) and can't be mixed with other fields
- `:id` not a uuid → 404 (same as listings)

## Cases

Users from `npm run seed`: anna owns Åre/Södermalm/Studio, erik owns Seaside/Haga/Malmö, sara is a guest. Dates are relative to today with REST Client's `{{$datetime "YYYY-MM-DD" N d}}`.

**Must work**
- sara books Malmö (1100/night, max 4), 3 guests, today+60 → +63 → 201, `total_price` 3300.
- Same with `"total_price": 1` in the body → 201, still the computed price (VG6).
- erik books Åre on sara's check-out day (today+18 → +20) → 201 (VG2 `[)`).
- sara edits her Malmö booking to +61 → +64 (overlaps its own old dates) → 200, new price (VG2, VG6).
- `GET /listings/<malmö>/bookings` as erik (owner) → sees sara's booking. As anna → doesn't (VG1).
- sara cancels it → 200, `status: cancelled`. Then deletes it → 204.

**Must fail**
- Logged out: any of the four → 401.
- `guests: 0`, invalid email, check-out before check-in, `check_in: "tomorrow"` → 400 (G10).
- `guests: 5` on Malmö → 400 (VG3).
- `check_in` yesterday → 400 (VG5).
- erik books Åre today+15 → +17 (sara has +14 → +18) → 409 (VG2). Also on edit: erik moves his +18 → +20 Åre booking to +17 → +20 → 409.
- anna books her own Åre → 403.
- POST to a random listing uuid → 404.
- erik (owner) PATCH/DELETE sara's booking on Seaside → 403. anna (not involved) → 404.
- sara edits, cancels or deletes her **past** Seaside booking (`seed_past_booking.sql`) → 400 (VG5).
- PATCH `{}`, `{ status: 'active' }` → 400. PATCH/DELETE random uuid → 404.

## How it's tested

New `# Bookings` section in `backend/tests/api.http`, one call per case, expected status in the comment. Preconditions as for listings (`npm run seed` + `seed_past_booking.sql`). Listing and booking ids come from earlier calls via `# @name`, no hard-coded uuids.

## Build steps

1. `src/routes/bookings.ts`: schemas, the four routes, DB error → status mapping (`23514` → 400 with the DB message, `23P01` → 409, `42501` → 403, `23503` → 404).
2. Mount: `app.route('/', bookings)` (or split into `/listings/:id/bookings` + `/bookings`), in `src/index.ts`.
3. Add the calls to `tests/api.http` and run all cases.

## Notes from building

- All cases verified: 50 calls, all with the expected status (run with curl, same calls and order as `backend/tests/api.http`). The file cleans up after itself, so it can be run again.
- The overlap/check-out-day cases use bookings made in the test file itself (sara, then anna on Malmö), not the seeded Åre booking: seeded dates are relative to the day `npm run seed` ran, so they drift.
- `invalid`, `readBody` and `idSchema` moved from `routes/listings.ts` to `src/lib/http.ts`, shared by both routers.
- `check_in: "tomorrow"` also gets a "Check-out must be after check-in" message on `check_out`: Zod still runs the date-order refine when a field is invalid. Status is right (400) and the frontend's date input can't send it, so left as is.
- PATCH `{}` and cancel + edit in one call give 400 with empty `details` (whole-body errors, like listings).
