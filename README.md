# StayFinder

StayFinder is a full-stack booking service where users can find places to stay and book them. Hosts list their places, and guests search, filter, sort and book them.

## About the project

This is an **individual, graded school assignment** for the course **Backend 2 (TypeScript)** at **Nackademin – Webb25** (graded IG / G / VG). The task was to build a booking service with both a backend and a frontend that work together, and to be able to explain what happens in the frontend, in the API and in the database, and why.

The project was built from scratch using the same stack as the course:

| Part | Tech |
|---|---|
| Backend | [Hono](https://hono.dev) (TypeScript, Node) + [Zod](https://zod.dev) for validation |
| Database and auth | [Supabase](https://supabase.com) (Postgres, Supabase Auth, Row Level Security) |
| Frontend | [Next.js](https://nextjs.org) (App Router) + TypeScript + Tailwind |

**Target grade: VG.** All of G1–G16 are done, plus five VG criteria (VG1, VG2, VG3, VG5, VG6), one more than the four required.

## Repo layout

```
backend/    Hono API (http://localhost:3001)
  src/routes/      auth, listings, bookings, me
  src/middleware/  requireUser (401 when not logged in)
  src/lib/         per-request Supabase client, error → HTTP status mapping
  tests/           Postman collection with every test call
frontend/   Next.js app (http://localhost:3000)
supabase/
  migrations/  tables, RLS policies, constraints and triggers
  seed/        reset script and the past booking used to test VG5
  tests/       SQL tests for the RLS policies and booking rules
```

## Getting started

1. Create a Supabase project and run the SQL files in `supabase/migrations/` in order. In Auth → Providers → Email, turn off "Confirm email" for local development.
2. Copy `backend/.env.example` to `backend/.env` and fill in `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Copy `frontend/.env.example` to `frontend/.env.local`.
3. Start both apps, each from its own folder:
   ```bash
   cd backend && npm install && npm run dev    # http://localhost:3001
   cd frontend && npm install && npm run dev   # http://localhost:3000
   ```
4. Seed the database (see `backend/README.md`): `supabase/seed/reset.sql` → `npm run seed` in `backend/` → `supabase/seed/past_booking.sql`. Every seed user's password is `password123`, e.g. `anna@stayfinder.test`.

The API only ever uses the Supabase **publishable key** plus the logged-in user's session cookies, never the service-role key. That means every request runs as the real user, and the database's RLS policies always apply.

## API tests

`backend/tests/stayfinder.postman_collection.json` has 125 test calls in the folders Auth, Listings, Bookings and My page. For every rule there is a call that should succeed and calls that should be rejected, and each call checks its own expected status code (some also check a value in the body).

- **Postman desktop:** Import the file, then Run collection.
- **Terminal:** `npx newman run tests/stayfinder.postman_collection.json` in `backend/`

Run it top to bottom on a fresh seed, with the backend running.

## Criteria fulfilled

### G (all required)

**Account and login**
- [x] **G1** A visitor can create an account, log in and log out.
- [x] **G2** The login survives a page reload, and the app can always show who is logged in.
- [x] **G3** The navigation shows different content for a logged-in user and a logged-out visitor.

**Listings**
- [x] **G4** Anyone can see a list of listings and a detail page for each one.
- [x] **G5** The list can be filtered by location, max price and number of guests.
- [x] **G6** Only logged-in users can create, update and delete listings, enforced both in the API and in the database.
- [x] **G7** A logged-in user can create a new listing through a form in the frontend.
- [x] **G8** The list can be sorted by price, ascending or descending. The sorting is done in the backend.

**Bookings**
- [x] **G9** A logged-in user can book a listing from its detail page. A logged-out visitor is asked to log in.
- [x] **G10** A booking with invalid data is rejected (e.g. invalid email, zero guests, check-in after check-out), and the error is shown clearly in the form.
- [x] **G11** The booking form shows the number of nights and the total price before the user books.
- [x] **G12** A logged-in user can see, edit and delete bookings for a listing.

**Quality**
- [x] **G13** The app shows a loading view and an error view while fetching data, plus its own page when a listing doesn't exist.
- [x] **G14** The API answers with the right status code on success (200), on creation (201), on delete (204), for invalid data (400), when not logged in (401), when not allowed (403), when something is missing (404) and on conflicts (409).
- [x] **G15** The database protects its own tables with Row Level Security, so the API is not the only protection.
- [x] **G16** All data is typed in both the backend and the frontend (TypeScript `strict`, no `any`, database types generated from Supabase).

### VG (five chosen)

Every VG rule is enforced **in the database**, so it holds even when someone calls the API directly without the frontend. The API validates input and turns database errors into clear status codes, and the frontend shows the result and any errors.

| Criterion | What it means | Where it lives |
|---|---|---|
| **VG1 Ownership** | A listing belongs to its creator and a booking to the user who made it. Only the owner can update or delete their listing. A guest sees only their own bookings, and the listing owner sees all bookings for that listing. | RLS policies on `listings` and `bookings` (`auth.uid()`). The API returns 403/404. |
| **VG2 No double bookings** | A listing can't be booked for dates that overlap an existing booking that isn't cancelled, both when creating and when editing. A booking doesn't clash with itself. | Exclusion constraint `bookings_no_overlap` (`daterange` + `btree_gist`), ignoring cancelled bookings. The API returns 409. |
| **VG3 Capacity** | The number of guests can't exceed the listing's max. The check uses the listing's current data in the database, not anything the client sends. | Trigger `bookings_capacity`. The API returns 400. |
| **VG5 Time rules** | A check-in date that has already passed is rejected, and a booking whose check-in has passed can't be edited or cancelled. | Trigger `bookings_time`. The API returns 400. The frontend shows started bookings as "Started" with no buttons. |
| **VG6 Server-side price** | The total price is computed from the number of nights and the listing's price, and saved on the booking. A price sent by the client is ignored, and later price changes don't affect existing bookings. | Trigger `bookings_price`. The frontend price is only a preview. |

Not chosen: VG4 (status flow with roles) and VG7 (search by free dates).
