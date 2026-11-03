# Feature 10: Create listing form

**Criteria:** G7 (and the frontend side of G3, G6, G16). The API part is done (`specs/archive/listings-api.md`, `POST /listings`).

## What

- A new page `/listings/new` with a form: title, location, price per night, max guests, and description (optional).
- Submitting calls `POST /listings`. On **201** the user lands on the new listing's detail page `/listings/<id>`.
- The navbar gets a **"New listing"** link, shown only to logged-in users (G3).
- A logged-out visitor who opens `/listings/new` is **redirected to `/login?next=/listings/new`**. After logging in, they're sent back to the form.

Not in this feature: editing or deleting a listing in the UI. No criterion asks for it (G7 is create only). The API and DB already enforce the owner-only rules (G6, VG1), and `api.http` tests them.

## How the page gets its data

**Decision: a client component (`'use client'`), like `AuthForm`.**

- `POST /listings` needs the user's session cookies. Only the browser has them, because they're httpOnly cookies from the API's domain. A server action or server component would have to forward them by hand. That's the same reason auth runs in the browser (`auth-ui.md`).
- `useAuth()` already says whether someone is logged in, so the page knows whether to show the form or redirect.
- The form state is plain `useState`, one per field, like `AuthForm`. No form library.

## Redirect to login and back

- `/listings/new` waits until `useAuth()` has finished loading. Until then it shows "Loading…". Redirecting earlier would send a logged-in user to `/login` on every reload, because `/auth/me` hasn't answered yet.
- Then, if there's no user: `router.replace('/login?next=/listings/new')`. `replace` rather than `push`, so the back button doesn't land on a page that redirects again.
- `AuthForm` currently always goes to `/` after logging in. Now it goes to `next` if one is given, otherwise `/`. Register does the same, and the "Register" / "Log in" links between the two pages pass `next` along.
- **`next` is only followed if it's a path in our own app**: it starts with `/` but not `//`. Otherwise it's ignored and the user goes to `/`. Without this check, a link like `/login?next=https://evil.example` would send the user to another site right after they log in (an "open redirect").
- The login and register pages get `next` from `searchParams` and pass it to `AuthForm` as a prop.

This touches `AuthForm` (features 8 and 9). Logging in without `next` must still go to `/` as before.

## Sending the data

- `price_per_night` and `max_guests` come out of the inputs as strings. They're sent as numbers with `Number(value)`, because the API's Zod schema wants `z.int()`, not a string.
- An empty description is sent as `""`. The API turns it into `null`, so the frontend doesn't need its own rule for it.
- `owner_id` is **not** sent. The DB sets it to `auth.uid()`, and the API drops it if someone sends it anyway.
- A new `createListing(input)` in `lib/listings.ts` wraps `apiFetch<Listing>('/listings', { method: 'POST', body })`.

## Error messages (decided: option A)

**Decision: custom messages in the backend's Zod schema** (`createSchema` in `backend/src/routes/listings.ts`). The frontend shows them exactly as the API sends them.

- The wording lives in one place, and anyone who calls the API directly gets the same clear messages.
- There's no behaviour change: the status codes, fields and rules stay the same. `updateSchema` is `createSchema.partial()`, so PATCH gets the same messages for free.
- The booking form (feature 11) will do the same.

| Field | Problem | Message |
|---|---|---|
| `title` | missing, empty or only spaces | Title is required |
| `title` | over 100 characters | Title can be at most 100 characters |
| `location` | missing, empty or only spaces | Location is required |
| `location` | over 100 characters | Location can be at most 100 characters |
| `description` | over 1000 characters | Description can be at most 1000 characters |
| `price_per_night` | missing, not a number or not whole | Price must be a whole number |
| `price_per_night` | under 1 | Price must be at least 1 kr |
| `max_guests` | missing, not a number or not whole | Max guests must be a whole number |
| `max_guests` | under 1 | Max guests must be at least 1 |

## Cases

**Must work**
- Logged in: the navbar shows "New listing". Clicking it opens the form.
- Logged out: the navbar has no "New listing" link (G3).
- Fill in every field correctly and submit → the user lands on `/listings/<new id>` showing exactly what was typed (G7).
- Leave the description empty → it's created, and the detail page shows no description.
- After creating, go to `/` → the new listing is at the top (newest first).
- While submitting, the button is disabled and shows "…", so a double click can't create two listings.

- Logged out, open `/listings/new` → redirected to `/login?next=/listings/new` → log in → back on the form.
- Same, but click "Register" on the login page and create an account → back on the form.
- Log in normally from the navbar (no `next`) → `/`, as before.
- Logged in, reload `/listings/new` → the form stays. No jump to `/login` while `/auth/me` is still answering.

**Must fail: redirects**
- `/login?next=https://example.com` → log in → `/`, not example.com.
- `/login?next=//example.com` → log in → `/`.

**Must fail: invalid data, shown under the right field**

The browser's own checks (`required`, `min="1"`, `maxLength`) stop most bad values before they're sent, but that's quick feedback only. To test the API's messages, the bad values have to reach the API:

- Title of only spaces → passes `required` in the browser, the API trims it → **400** "Title is required" under Title. This case needs no devtools.
- In devtools, add `novalidate` to the `<form>` (turns off all the browser's checks, as if the frontend didn't exist). Then submit:
  - every field empty → **400**, a message under title, location, price and max guests at the same time
  - price `0` → "Price must be at least 1 kr"
  - max guests `0` → "Max guests must be at least 1"
  - price `1.5` → "Price must be a whole number"
- After a 400, fix one field and submit again → that field's message disappears and the other messages remain until those fields are fixed too.
- In every case above the fields keep what the user typed, and nothing is created (check `/`).

**Must fail: other errors**
- Logged out in another tab, then submit → API **401** → "You're no longer logged in" with a "Log in again" button that leads to `/login?next=/listings/new`. The fields keep their values.
- Backend stopped → "Something went wrong, try again" above the button. The fields keep their values.

## Where each rule lives

| Rule | Frontend | API | DB |
|---|---|---|---|
| Only logged-in users create (G6) | hides the link, redirects to `/login` (UX only) | `requireUser` → 401 | no insert grant for `anon` |
| Redirect only within the app | `next` must start with `/`, not `//` | – | – |
| Valid fields | `required`, `min="1"`, `maxLength` (UX only) | Zod → 400 with field errors | CHECK constraints |
| Owner is the logged-in user (VG1) | doesn't send `owner_id` | Zod drops it | `owner_id default auth.uid()` + insert policy |

The frontend checks are only there for quick feedback. Anyone can skip them by calling the API directly, so the API and the DB are the real guards.

## Types (G16)

`lib/types.ts` gets `NewListing = { title: string; description: string; location: string; price_per_night: number; max_guests: number }`. That's the body of `POST /listings`. `createListing` returns `ApiResult<Listing>`, the type that already exists. No `any`, and no new casts.

## How it's tested

**API (`backend/tests/api.http`, `# Listings` section).** The 201, 401 and 400 calls already exist. Changes:

- Each existing 400 call's comment also gives the expected message, e.g. `# 400, details.price_per_night: "Price must be at least 1 kr"`.
- New 400 calls: title of only spaces, `price_per_night: 1.5`, `max_guests` missing, and a title of 101 characters.
- Re-run the whole listings section, so it's checked that the status codes are unchanged and the new messages come back.

**Frontend:** click through every case above as anna (from `npm run seed`). Test listings created along the way are deleted afterwards with `DELETE /listings/:id` from `api.http`.

## Notes from building

- **Verified:** all 42 listings calls in `api.http` pass with the expected status, and each 400 returns the message from the table under the right field (run with curl). All 31 browser checks of the cases above pass (a headless Playwright script, kept outside the repo).
- **Extra rule in `safeNext`:** `next` must also not contain `\`. Browsers read `/\evil.example` the same as `//evil.example`, so the spec's two rules weren't enough. Tested: `https://example.com`, `//example.com` and `/\example.com` all lead to `/`.
- **"Log in again" is a button, not a link.** After a 401 the app still thinks the user is logged in (`useAuth()` has the old user), so a link to `/login` would bounce straight back to the form. The button calls `logout()`, which clears the user, and the page's own redirect then goes to `/login?next=/listings/new`.
- **Logging out from the navbar while on `/listings/new` lands on `/login?next=/listings/new`, not `/`.** `logout()` clears the user, and the page's redirect fires before the navbar's `router.push('/')`. It's the same rule as above. Left as is (open question for the user).
- **`cacheComponents` keeps client component state between navigations** (React `<Activity>`), so the form clears its fields itself after a successful create. Earlier pages also stay in the DOM, hidden, which the test script had to account for.
- The login and register pages are now async server components that read `searchParams`. `npm run build` passes, and the `loading.tsx` in `app/` is the `<Suspense>` boundary they need, so no extra one was added.
- After adding the route, `npx next typegen` had to run before `npx tsc --noEmit` knew about it (`PageProps<'/listings/[id]'>` errors otherwise). `next dev` and `next build` do this automatically.
- `/` shows the new listing at the top without `router.refresh()`: the list is fetched on the server for every request.
- With the browser's checks turned off, an empty price gives "Price must be at least 1 kr", because `Number('')` is `0`.
- The register test created a user (`create-listing-<timestamp>@stayfinder.test`), which is still in `auth.users`.

## Build steps

1. Check the current docs:
   - Zod (ctx7): custom messages on `z.string()`, `z.int()` and `.min()` / `.max()`
   - Next.js (`frontend/node_modules/next/dist/docs/`): a static `new` folder next to a dynamic `[id]` folder; `searchParams` on the login page (with `cacheComponents`, it may need a `<Suspense>`); and whether `/` shows the new listing after `router.push`, or needs `router.refresh()`
2. Backend: add the messages to `createSchema` in `backend/src/routes/listings.ts`. Update and add the listings calls in `api.http`, and re-run them all.
3. `lib/types.ts`: add `NewListing`. `lib/listings.ts`: add `createListing`.
4. `AuthForm` + the login and register pages: the `next` prop, the safe-path check and the links that pass `next` along.
5. `components/ListingForm.tsx`: the form, with field errors and a form error shown the same way as `AuthForm`.
6. `app/listings/new/page.tsx`: wait for auth, redirect if logged out, otherwise `<ListingForm />`.
7. `components/Navbar.tsx`: a "New listing" link in the logged-in branch.
8. Click through the cases.
