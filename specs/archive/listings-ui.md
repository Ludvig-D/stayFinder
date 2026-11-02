# Feature 9: Listings UI (list, filters, sort, detail, loading/error/not found)

**Criteria:** G4, G5, G8, G13 (frontend part), G16. The API part is done (`specs/archive/listings-api.md`).

## What

- `/` shows all listings as cards (title, location, price per night, max guests), each linking to its detail page.
- A filter bar above the list: location, max price, guests, and a sort select (newest / price ascending / price descending).
- `/listings/[id]` shows one listing: title, location, description, price per night, max guests.
- A loading view while fetching, an error view when the API fails, and a "Listing not found" page (G13).

Not in this feature: the booking form on the detail page (feature 11), create/edit/delete buttons (feature 10). The detail page gets a placeholder box where the booking form will go.

## How the pages get their data

**Decision: server components that fetch from the API on the Next server.**

- Listings are public, so the fetch needs no cookies. That avoids the cookie-forwarding problem that made us pick the browser for auth (`auth-ui.md`).
- Next's special files then work without extra code: `loading.tsx` shows while the server component awaits the fetch, `error.tsx` catches a thrown error, and `notFound()` renders `not-found.tsx`.
- Reuses `apiFetch` from `lib/api.ts` (it works on the server too; `credentials: 'include'` just has no effect there).
- Alternative: client components with `useEffect` + `useState` for loading/error. More code, and the G13 views would be hand-made instead of Next's built-in ones.

## Filters and sorting live in the URL

**Decision:** the filter bar is a GET form (`<Form action="/">` from `next/form`: a normal HTML GET form that navigates client-side, so there's no full page reload). Submitting it gives e.g. `/?location=stock&maxPrice=900&sort=price_asc`. The page reads `searchParams` and passes them straight on to `GET /listings`.

- The filtering and sorting happen **in the API/DB query** (G8 says sorting must be in the backend). The frontend never sorts or filters the array itself.
- The URL is the state: reload, back button and sharing a link all keep the filters. No React state needed.
- The form's fields are prefilled from `searchParams`, so you see what's active. A "Clear" link goes to `/`.
- **Empty fields are dropped** before calling the API. The browser sends `location=` for an empty input, and the API rejects an empty string / `0` with 400.

## Cases

**Must work**
- `/` logged out → all listings, newest first (G4).
- Location `stock` → only the Stockholm listings (G5).
- Max price `900` → only listings ≤ 900. Guests `4` → only listings with max guests ≥ 4 (G5).
- Location `stockholm` + sort price ascending → 650 before 950. Descending → the other way (G8).
- Filters + reload → same result, fields still filled in.
- Filters that match nothing → "No listings match your filters" (not an empty page).
- Click a card → `/listings/<id>` with its details (G4).

**Must fail, with a clear view**
- `/listings/<random uuid>` → "Listing not found" page with a link back to `/` (API 404 → `notFound()`).
- `/listings/not-a-uuid` → the same page (the API already answers 404).
- Hand-typed bad filter, e.g. `/?maxPrice=abc` → API 400 → a message above the list: "Invalid filter", plus the "Clear" link. Not the error view, because it's the user's input, not a broken server.
- Backend stopped → error view: "Could not load listings" with a "Try again" button (`error.tsx`, which calls `retry()`).
- While loading (slow API) → loading view (`loading.tsx`). Checked by throttling in devtools or a short delay in the API.

## Where each rule lives

| Rule | Frontend | API | DB |
|---|---|---|---|
| Filter/sort values are valid | `type="number" min="1"` (UX only), drops empty fields | Zod → 400 | – |
| Filtering and sorting | only builds the query string | passes it to the query | `ilike` / `<=` / `>=` / `order by` |
| Listing exists | shows `not-found.tsx` on 404 | 404 | the row is there or not |
| Anyone may read | no login check | no `requireUser` on GETs | `select` policy open to `anon` |

## Types (G16)

`frontend/lib/types.ts` gets `Listing` (same fields as `Tables<'listings'>` in the backend) and `ListingFilters = { location?: string; maxPrice?: string; guests?: string; sort?: string }`. All strings: they are raw text from the URL, and the API is what checks them (a stricter type here would need a cast or a second validator).
Written by hand in the frontend rather than importing the backend's generated file: the two projects are separate npm packages.

## How it's tested

No new API calls (the API cases already exist in `backend/tests/api.http`). Verified by a click-through of every case above, with `npm run seed` data.

## Notes from building

- All cases above verified with a headless-browser click-through (Playwright) against `npm run seed` data. Loading and error views were checked by pointing the frontend at a small proxy that delays every API call by 3 s, then stopping it. The backend itself was never stopped.
- This Next version (16.4, `cacheComponents: true`) wants a `<Suspense>` boundary **in the segment that fetches**. `app/loading.tsx` doesn't cover `/listings/[id]`, so that segment has its own `loading.tsx`, plus its own `error.tsx` so the message says "this listing" and not "listings".
- `error.tsx` gets `retry()` (not `reset()` as in older Next). `retry()` calls `router.refresh()`, so it fetches again from the server. `reset()` would only re-render the old result.
- The docs were read from `frontend/node_modules/next/dist/docs/` (as `frontend/AGENTS.md` says), not ctx7: they match the installed version exactly.
- The filter form has `key={JSON.stringify(filters)}`. The inputs are uncontrolled, so without the key, "Clear" would change the URL while the old text stayed in the fields.
- The URL after a search still has empty keys (`?location=stockholm&maxPrice=&guests=&sort=price_desc`). That's how a GET form works. `getListings` drops them before calling the API.
- "1 guest" / "2 guests": singular when `max_guests` is 1.
- `frontend/` had no `node_modules` or `.env.local` on this machine. Ran `npm ci` and copied `.env.example` to `.env.local`.

## Build steps

1. Check the current Next.js docs for `searchParams`/`params` (async in recent versions), `loading.tsx`, `error.tsx`, `not-found.tsx`.
2. `lib/types.ts`: `Listing`, `ListingFilters`.
3. `lib/listings.ts`: `getListings(filters)` (drops empty values, builds the query string) and `getListing(id)`.
4. `components/FilterBar.tsx` (the GET form; not `ListingFilters`, which is the type) and `components/ListingCard.tsx`.
5. `app/page.tsx` (replaces the Next starter page), `app/loading.tsx`, `app/error.tsx`.
6. `app/listings/[id]/page.tsx`, `loading.tsx`, `error.tsx`, `not-found.tsx`.
7. Click through the cases.
