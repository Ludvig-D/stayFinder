# StayFinder — Project overview

A single file covering the assignment, our decisions, the criteria checklist, how we work, and useful notes.

---

## 1. The assignment in short

Build StayFinder as a working booking service, with both a backend and a frontend. Users can find listings and book them.

- **Individual** work, graded IG / G / VG.
- **Submission:** **Wed 4 Nov 2026, 23:59**
- **Oral code review:** **Thu 5 Nov 2026**, about 8–10 minutes.
- **You are responsible for all code you submit**, whether it comes from lessons, from you, or from AI. Code you can't explain at the oral exam counts as **not fulfilled**.
- Not every part is covered in the lessons. You're expected to look things up in the docs of the tools we use.

**What the assignment tests:** whether you can build an app that hangs together, and explain what happens in the frontend, in the API and in the database, and why.

---

## 2. Decisions made

| Decision | Choice |
|---|---|
| Start code | **From scratch**, using the same stack as the course |
| Target grade | **VG**: all of G1–G16 plus **VG1, VG2, VG3, VG5, VG6**. That's 5, one more than the 4 required, as margin. |
| Repo layout | **One repo**: `backend/` and `frontend/` folders |
| Way of working | **Spec-driven, one feature at a time** (see §5) |
| Deleting a listing with a started booking | **Blocked** by the DB (`bookings_time` fires on the cascade, `23514`). Kept on purpose to protect booking history; the API returns 409 |

**Stack**
- Backend: **Hono** (TypeScript, Node), **Zod** for validation
- Database and auth: **Supabase** (Postgres, Supabase Auth, Row Level Security)
- Frontend: **Next.js** (App Router) + **TypeScript**

---

## 3. Criteria checklist

Tick each box when the feature works **and** has a test call in the test file.

### G — all of them required

**Account and login**
- [x] **G1** A visitor can create an account, log in and log out.
- [x] **G2** The login survives a page reload, and the app can always show who is logged in.
- [x] **G3** The navigation shows different content for a logged-in user and a logged-out visitor.

**Listings**
- [x] **G4** Anyone can see a list of listings and a detail page for each one.
- [x] **G5** The list can be filtered by location, max price and number of guests.
- [x] **G6** Only logged-in users can create, update and delete listings. This must hold **both in the API and in the database**.
- [x] **G7** A logged-in user can create a new listing through a form in the frontend.
- [x] **G8** The list can be sorted by price, ascending or descending. **Sorting is done in the backend.**

**Bookings**
- [ ] **G9** A logged-in user can book a listing from its detail page. A logged-out visitor is asked to log in.
- [ ] **G10** A booking with invalid data is rejected (e.g. invalid email, zero guests, check-in after check-out), and the error is shown understandably in the form.
- [ ] **G11** The booking form shows the number of nights and the total price before the user books.
- [ ] **G12** A logged-in user can see, edit and delete bookings for a listing.

**Quality**
- [x] **G13** The app shows a loading view and an error view while fetching data, plus its own page when a listing doesn't exist.
- [x] **G14** The API answers with the right status code on success, on creation, for invalid data, when the user isn't logged in, and when something is missing.
- [x] **G15** The database protects its own tables with access rules (RLS). It's not enough for only the API to protect them.
- [ ] **G16** All data is typed in both backend and frontend.

### VG: our chosen five

All VG rules must hold **in the API and the database**, even when someone calls the API directly without the frontend. The frontend only has to show the result and any errors.

- [ ] **VG1 Ownership.** A listing belongs to the user who created it, and a booking belongs to the user who made it. Only the owner can update or delete their listing. A guest sees only their own bookings, and the listing owner sees all bookings for that listing. **The database must guarantee this**, not just the API.
- [ ] **VG2 No double bookings.** A listing can't be booked for dates that overlap an existing booking that isn't cancelled. This applies when a booking is created and when it's edited. A booking being edited must not count as a clash with itself. A clash is rejected with its own clear error.
- [ ] **VG3 Capacity.** The number of guests can't exceed the listing's max. The check uses the listing's current data **in the database**, not anything the client sends.
- [ ] **VG5 Time rules.** A check-in date that has already passed is rejected, and a booking whose check-in has passed can't be edited or cancelled.
- [ ] **VG6 Price computed on the server.** The booking's total price is computed in the backend from the number of nights and the listing's price, and saved on the booking. A price sent by the client is ignored. If the listing's price changes later, existing bookings are not affected.

### Not chosen (could be extra margin if time allows)
- **VG4 Status flow with roles.** Only the owner can confirm, and the guest and owner can both cancel. Pending can become confirmed or cancelled, confirmed can become cancelled, and cancelled is final.
- **VG7 Search by free dates.** The API returns listings that are free during a given period, combined with the filters and sorting. Invalid periods are rejected.

> Note: VG2 talks about bookings that are "not cancelled", and VG5 about bookings that can't be "cancelled". So bookings need some kind of **cancelled status**, even without VG4.

---

## 4. What to submit

- [ ] **Repo link** (backend + frontend)
- [ ] **A list of the criteria you've fulfilled**
- [ ] **A file of test calls against the API** that shows the rules work, **both successful calls and rejected bad calls**. For VG, it must show that each chosen VG rule rejects bad calls.

---

## 5. How we work: spec-driven, one feature at a time

For every feature:

1. **Pick** the next feature from the order below.
2. **Spec it** in a short file `specs/<feature>.md`, just a few lines:
   - *What* it should do (which criteria it covers)
   - *Cases that must work* and *cases that must fail* (with the expected status codes)
   - *Where* each rule lives: frontend, API or database, and why
   - *How it's tested*: which calls go in the test file
3. **Build** it.
4. **Verify** it against the spec: run the test calls and click through it in the app.
5. **Update the spec** if reality differed from the plan, then tick the criteria in §3 and move the spec to `specs/archive/`.

### Suggested feature order

| # | Feature | Criteria |
|---|---|---|
| 1 | Project setup (repo, Supabase project, backend + frontend running) | — |
| 2 | Listings table + RLS | G6, G15, VG1 |
| 3 | Listings API: list, detail, create, update, delete | G4, G6, G14, G16, VG1 |
| 4 | Filters + sorting in the API | G5, G8 |
| 5 | Auth API: register, login, logout, me | G1, G2 |
| 6 | Bookings table + RLS + DB rules | G10, G15, VG1, VG2, VG3, VG5, VG6 |
| 7 | Bookings API: create, list, edit, cancel, delete | G9, G10, G12, G14 |
| 8 | Frontend: auth pages + navbar | G1, G2, G3 |
| 9 | Frontend: listing list, filters, sort, detail page, loading/error/not found | G4, G5, G8, G13 |
| 10 | Frontend: create listing form | G7 |
| 11 | Frontend: booking form + bookings list | G9, G10, G11, G12 |
| 12 | Test file complete, README with criteria list, oral prep | all |

(Auth could also come before listings. Do whatever order makes sense to you.)

### Rough schedule

| Days | Focus |
|---|---|
| Tue 27 – Wed 28 Oct | Setup, listings (DB + API) |
| Thu 29 – Fri 30 Oct | Auth, bookings (DB + API). **Backend done.** |
| Sat 31 Oct – Mon 2 Nov | Frontend |
| Tue 3 Nov | Test file, README, polish, oral prep |
| Wed 4 Nov | Buffer, then submit before 23:59 |

---

## 6. Oral code review

**Format:** you demo the flow in the app, then the teacher picks **2–3 criteria** for you to explain in your code.
**For VG:** for every chosen VG rule, you must explain **where it lives (API, database or both), why it lives there, and which cases you've tested.**

**Example questions to prepare:**
- [ ] What's the difference between **authentication** and **authorization**?
- [ ] Why must the frontend **send cookies** with its requests?
- [ ] Why isn't it enough to protect routes **only in the API**?
- [ ] Why is this rule in the API, in the database, or in both?
- [ ] What happens if someone calls the API **directly**, without the frontend?
- [ ] What are the pros and cons of **TypeScript**, and how do they show up?
- [ ] When can you step outside TypeScript's rules, and how do you do it?
- [ ] What's a key difference between **`type`** and **`interface`**?

Tip: write down the answers in your own words as you build each feature, while it's fresh.

---

## 7. Useful notes and gotchas

These are pointers to look into, not finished answers. Check the current docs.

**Supabase**
- New projects use a **publishable key** (formerly the "anon key") and a **secret / service-role key**. The service-role key **bypasses RLS**. If the API used it, G15 and VG1 would only be "protected by the API". Use the publishable key plus the logged-in user's session, so RLS applies.
- With **"Confirm email"** turned on, sign-up doesn't log the user in until they click an email link. For development it's easier to turn it off (Auth → Providers → Email).
- **RLS is off by default** on tables created with SQL. Turn it on for every table. With RLS on and no policies, nobody can access anything.
- In policies and SQL, `auth.uid()` is the id of the logged-in user making the request.
- You can generate TypeScript types from your database with the Supabase CLI (`supabase gen types typescript`). That helps with G16.
- Keep your SQL (tables, policies, functions) in files in the repo, e.g. `supabase/migrations/`, so it's part of the submission and you can show it.

**Auth with cookies (Hono + Supabase)**
- `@supabase/ssr` → `createServerClient` takes a `cookies` object with `getAll` / `setAll`. In Hono you can read and write cookies with `hono/cookie`, and `parseCookieHeader` from `@supabase/ssr` parses the Cookie header.
- Create **one Supabase client per request**, so each request runs as its own user.
- To check who's logged in on the server, `supabase.auth.getUser()` verifies the token against Supabase. Don't just trust whatever is in the cookie.

**CORS and cookies between frontend and API**
- Frontend fetches need `credentials: 'include'`, or the browser won't send the cookies.
- The Hono CORS middleware then needs `credentials: true` and an **exact origin** (e.g. `http://localhost:3000`). `*` doesn't work together with credentials.
- `localhost:3000` and `localhost:3001` count as the same *site*, so `SameSite=Lax` cookies work between them locally.

**Database rules worth knowing about (for VG)**
- **CHECK constraints**: simple rules on a row, e.g. `guests >= 1` or `check_out > check_in`.
- **Triggers** (`BEFORE INSERT OR UPDATE`): run code in the database on every write. They can look up other tables, change values (e.g. compute a price), or raise an error.
- **Exclusion constraints** with `daterange` and `&&` (needs the `btree_gist` extension) are Postgres's built-in way to forbid overlapping ranges. Look up how to make them ignore cancelled rows.
- Postgres errors come back to supabase-js with an `error.code` (SQLSTATE). The API can map those codes to clear HTTP errors.
- Think about **time zones** for "today" in VG5 (the database runs in UTC).
- Think about what "overlap" means for check-out day = next guest's check-in day.

**Status codes (G14)**
| Code | When |
|---|---|
| 200 | OK |
| 201 | Something was created |
| 204 | Deleted, nothing to return |
| 400 | Invalid data |
| 401 | Not logged in |
| 403 | Logged in but not allowed |
| 404 | Doesn't exist |
| 409 | Conflicts with current state (e.g. double booking) |

**Next.js (App Router) for G13**
- Special files: `loading.tsx` (loading view), `error.tsx` (error view, must be a client component), and `not-found.tsx` together with `notFound()` for the "listing doesn't exist" page.

**Test file**
- An `.http` file (VS Code REST Client or httpyac) is easy to read and show. Write one call per rule, with a comment saying the expected result. Include **both** the call that should succeed and the ones that should be rejected.
- For VG5 you need a booking whose check-in has *already passed*, which your own rules won't let you create through the API. Think about how to set up that test data.

**Docs**
- Hono: https://hono.dev
- Supabase: https://supabase.com/docs (Auth, Row Level Security, `@supabase/ssr`)
- Next.js: https://nextjs.org/docs
- Zod: https://zod.dev
- Postgres: https://www.postgresql.org/docs/ (constraints, triggers, range types)

---

## 8. Progress log

| Date | What was done |
|---|---|
| 2026-10-27 | Project planned, decisions made, this file written |
| 2026-10-27 | DB specs written (`specs/listings-db.md`, `specs/bookings-db.md`). Migrations for listings, bookings and the 3 booking triggers applied. Listings RLS tests pass (`supabase/tests/listings.sql`). DB types generated. Seed script (`npm run seed`) + past booking for VG5 (`supabase/tests/seed_past_booking.sql`) |
| 2026-10-28 | All bookings DB cases verified (`supabase/tests/bookings.sql`, all cases pass). Specs moved to `specs/archive/`. Decided: deleting a listing with a started booking stays blocked → 409 |
| 2026-10-29 | Auth API built (`specs/archive/auth-api.md`): register, login, logout, me, per-request Supabase client, `requireUser`, CORS. All cases pass in `backend/tests/api.http`. G1/G2 not ticked until the frontend part (feature 8) |
| 2026-10-29 | Auth UI built (`specs/archive/auth-ui.md`): login/register pages, navbar, `AuthProvider` asking `/auth/me`. Click-through passes. G1–G3 ticked. Way of working changed: the user specs, Claude builds. Spec/AI files now committed |
| 2026-10-29 | Listings API built (`specs/archive/listings-api.md`, features 3 + 4): list with filters and sorting in the DB query, detail, create, update, delete. Non-owner → 403, missing → 404, listing with a started booking → 409. All 36 cases pass (`backend/tests/api.http`). G6 ticked. G4, G5, G8 wait for the frontend (feature 9); G14 and VG1 for bookings |
| 2026-10-29 | Bookings API built (`specs/archive/bookings-api.md`, feature 7): list per listing, create, edit, cancel, delete. DB errors mapped: overlap → 409, capacity/past date → 400 with the trigger's message, own listing → 403, owner editing a guest's booking → 403, someone else's → 404. Shared helpers in `src/lib/http.ts`. All 50 cases pass. G14, G15 ticked. G9, G10, G12 and VG1–VG6 wait for the frontend (feature 11): the VG rules also need the frontend to show the result and errors |
| 2026-10-29 | Listings UI built (`specs/archive/listings-ui.md`, feature 9): list on `/` as a server component, filters + sort in the URL (GET form, the API does the filtering and sorting), detail page `/listings/[id]` with a booking placeholder, loading/error/not-found views per segment. All click-through cases pass. G4, G5, G8, G13 ticked |
| 2026-11-02 | UI styling pass (`specs/archive/ui-styling.md`): dark-only Nordic palette, Familjen Grotesk, Airbnb-style search bar, sort dropdown above the list (`SortSelect`), listings as rows. No behaviour change, no new criteria. Rule added to `CLAUDE.md`: no code before the user says to build the spec |
| 2026-11-03 | Create listing form built (`specs/archive/create-listing-ui.md`, feature 10): `/listings/new` for logged-in users, logged-out visitors are redirected to `/login?next=` and come back after logging in or registering (`safeNext` only follows our own paths). Custom Zod messages in the listings API, shown under each field. 42 listings calls + 31 browser checks pass. G7 ticked |
