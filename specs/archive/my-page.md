# Extra: My page (my listings + my bookings)

**Criteria:** none new (G1–G16 and the chosen VG rules are all ticked). It makes VG1 (ownership) easy to show at the demo: one page with everything that belongs to the logged-in user.

## What

The email in the navbar becomes a link to **`/me`**. The page has two sections:

| Section | Shows | From |
|---|---|---|
| **My listings** | Every listing I own: title, location, price per night, max guests. Each row links to `/listings/<id>`. | `GET /me/listings` |
| **My bookings** | Every booking I made as a guest: listing title (link to the listing), dates, nights, guests, total price, status (Active / Cancelled / Started). | `GET /me/bookings` |

- **Read-only.** No edit/cancel/delete buttons here. You click through to the listing, where the existing booking section already handles that (G12). Keeps the feature small and reuses tested code.
- Empty states: "You have no listings yet" (with a link to `/listings/new`) and "You have no bookings yet".
- Bookings on *my listings* made by other guests are **not** shown here. The owner already sees them on each listing's detail page (VG1).
- Sorted in the API: listings newest first, bookings by check-in.

## API: two new routes, both `requireUser`

New file `backend/src/routes/me.ts`, mounted at `/me`.

| Call | Result |
|---|---|
| `GET /me/listings` logged in | **200**, `.eq('owner_id', user.id)` |
| `GET /me/bookings` logged in | **200**, `.eq('guest_id', user.id)`, with the listing's `id, title, location` joined in (`select('*, listing:listings(id, title, location)')`) |
| Either one logged out | **401** (`requireUser`) |

**Where the rules live, and why:**
- **Who may see a booking is still decided by RLS** (the existing select policy). The API can't widen it: it uses the publishable key + the user's cookies.
- The `.eq('guest_id', …)` filter is **not** a security rule. RLS returns "my bookings + bookings on my listings"; the filter picks only the first group, because that's what "My bookings" means. Good oral point: *RLS = what you're allowed to see, the query = what this page wants.*
- `.eq('owner_id', …)` on listings is the same: listings are public, so the filter only selects mine.

## Frontend

- `frontend/app/me/page.tsx`: a **client page**, same pattern as `/listings/new`, because both calls need the session cookies, which only the browser has.
  - Logged out → `router.replace('/login?next=/me')` (UX only; the API's 401 is the guard).
  - Loading: "Loading…". A failed call: "Could not load …" + "Try again" (G13 style), per section.
- `lib/me.ts`: `getMyListings()`, `getMyBookings()` via `apiFetch`. New type `MyBooking = Booking & { listing: Pick<Listing, 'id' | 'title' | 'location'> }` (G16).
- "Started" uses the existing `todayInStockholm()`; nights use the same calculation as `BookingRow`.
- Navbar: `<span>{user.email}</span>` → `<Link href="/me">{user.email}</Link>`.

## Tests

**`backend/tests/api.http`** (fresh seed):
- `GET /me/listings` logged out → 401
- `GET /me/bookings` logged out → 401
- As anna: `GET /me/listings` → 200, 4 listings, all `owner_id` = anna
- As anna: `GET /me/bookings` → 200, all `guest_id` = anna (none of the bookings guests made on her listings)
- As sara: `GET /me/listings` → 200, empty list
- As sara: `GET /me/bookings` → 200, includes the past booking, each row has `listing.title`

**Click-through:**
- Logged out, open `/me` → login page → log in → back on `/me`
- As anna: click the email → 4 listings + her own bookings; click a listing → detail page
- As sara: "You have no listings yet", bookings listed, past one marked "Started"
- Cancel a booking on a listing page → shows "Cancelled" on `/me`

## Result (2026-11-04)

Built as specced. All 125 `api.http` calls return the expected status (9 new). 15 browser checks pass.

What differed from the plan:
- `/me` has **one `GET` per section**, each with its own loading and error view, through a small generic hook `useApiData<T>` in `app/me/page.tsx`.
- **Logging out while on `/me` lands on `/login?next=/me`**, not `/`. The page's "not logged in → login" effect runs before the navbar's `router.push('/')`. `/listings/new` already behaves the same. Left as is: harmless, and fixing it means changing the shared logout flow.
- In the browser tests, Next (`cacheComponents`) keeps pages you've visited mounted but hidden, so the checks only look at visible elements.
