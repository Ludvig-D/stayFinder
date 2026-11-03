# Feature 11: Booking form + bookings list

**Criteria:** G9, G10, G11, G12, and the frontend side of VG1, VG2, VG3, VG5, VG6 (show the result and the errors). The rules are already in the DB (`specs/archive/bookings-db.md`) and the API (`specs/archive/bookings-api.md`). This feature is mostly frontend, plus clearer Zod messages in the bookings API.

## What

The "Booking coming soon" placeholder on `/listings/[id]` is replaced by a booking section. What it shows depends on who is looking:

| Who | Sees |
|---|---|
| Logged out | "Log in to book this stay" → `/login?next=/listings/<id>`, back on the listing afterwards (G9). No bookings list: the API needs a login to list bookings. |
| Logged in, not the owner | The booking form + **"Your bookings"**: their own bookings for this listing, with Edit, Cancel and Delete (G9, G12). |
| The listing's owner | "This is your listing" instead of a form + **"Bookings for your listing"**: every guest's booking, read-only (VG1). |

"Owner" is `user.id === listing.owner_id`. That only picks which view to show. The real guards are the API and RLS: the owner can't book (403) or change a guest's booking (403), and a guest can't see others' bookings (RLS filters them out).

The list comes from `GET /listings/:id/bookings`. The frontend doesn't filter it: RLS already returns "own" for a guest and "all" for the owner. Sorted by check-in (the API does that). Cancelled bookings are included.

## How the page gets its data

**Decision: the detail page stays a server component and renders a client component `<BookingSection listing={listing} />`.** Same reason as the create form: the bookings calls need the session cookies, which only the browser has. The listing itself is already fetched on the server and passed down as a prop (price, max guests, owner id).

- `BookingSection` waits for `useAuth()` to finish loading ("Loading…"), then fetches the bookings if someone is logged in.
- While the list loads: "Loading bookings…". If it fails: "Could not load bookings" with a "Try again" button (G13 style).
- After every create, edit, cancel or delete, the list is fetched again, so it always shows what the DB has (including the price the DB computed).

## The booking form (G9, G10, G11)

Fields: email, check-in, check-out, guests. `useState` per field, like `ListingForm`.

- **Email** is prefilled with the logged-in user's email, and can be changed.
- **Check-in / check-out** are `<input type="date">`, which always give `YYYY-MM-DD`. `min` on check-in is today in Stockholm (see VG5 below), and on check-out the day after check-in (quick feedback only).
- **Guests**: `type="number"`, `min={1}`, `max={listing.max_guests}` (quick feedback only), sent with `Number(value)`.
- **No `total_price` is sent.** The DB computes it (VG6).

**Price preview (G11):** once both dates are set and check-out is after check-in, the form shows

> 3 nights × 1100 kr = **3300 kr**

- Nights = `(new Date(checkOut) - new Date(checkIn)) / 86_400_000`. A date-only string like `"2026-11-10"` is parsed as midnight UTC, so the difference is always whole days, and daylight saving time can't add or remove an hour.
- This is only a preview. The DB's `bookings_price` trigger does the same sum and saves it, and the saved `total_price` is what the list shows afterwards. The preview uses `listing.price_per_night` from when the page loaded.

After **201** the form clears the dates and guests (keeps the email) and the new booking appears in "Your bookings".

## Editing, cancelling, deleting (G12)

Each booking row shows dates, nights, guests, email, total price and status. For the guest's own active bookings:

- **Edit** opens the same form inside the row, prefilled. "Save changes" / "Stop editing".
  - **Only the fields that changed are sent** in the PATCH. If check-in/check-out are in the update, the `bookings_price` trigger recomputes the price with the listing's *current* price. Sending unchanged dates when only the email was edited would change the price of an existing booking, which VG6 says must not happen.
  - Nothing changed → the form just closes, no call (the API would answer 400 "Send at least one field").
  - The price preview shows the saved `total_price` until the dates change, then the new sum.
- **Cancel** → `PATCH { status: 'cancelled' }`. The row stays, marked "Cancelled", and its dates are free again (VG2).
- **Delete** → `window.confirm('Delete this booking?')`, then `DELETE`. The row disappears.
- **Cancelled** bookings show only Delete. There is no un-cancel (the API doesn't allow it), and editing a cancelled booking makes no sense.
- The owner's view has no buttons.

### Bookings that have already started (VG5), decided: hide the buttons

The DB refuses to edit, cancel or delete a booking whose check-in has passed (sara's past Seaside booking from `seed_past_booking.sql`). The frontend doesn't offer what will be refused:

- A booking whose `check_in` is before today gets a **"Started"** label and **no buttons**, not even Delete (the DB refuses that too).
- "Today" is computed the same way as in the DB: the date **in Stockholm**, not the browser's own time zone. A helper `todayInStockholm()` in `lib/dates.ts` uses `Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Stockholm' })`, which formats as `YYYY-MM-DD`. Since `YYYY-MM-DD` strings sort like dates, "started" is just `booking.check_in < todayInStockholm()`.
- The same helper gives the `min` on the check-in input.
- **This is a second copy of the rule, for UX only.** The DB's `bookings_time` trigger is still the real guard: it holds for anyone calling the API directly, and if the page stays open past midnight the buttons are still there and the API answers 400, which is shown on the row. That's the answer to "why is the rule in both places?" at the oral.
- VG5 on edit/cancel/delete is therefore shown with `api.http`, not by clicking. A past check-in on a new booking can still be shown in the app (`novalidate`).

## Error messages

Like the listing form: **custom messages in the backend's Zod schema** (`fieldsSchema` in `backend/src/routes/bookings.ts`), shown under each field as the API sends them. `editSchema` is built from `fieldsSchema`, so editing gets the same messages.

| Field | Problem | Message |
|---|---|---|
| `email` | missing or not an email | Enter a valid email address |
| `check_in` | missing or not a date | Choose a check-in date |
| `check_out` | missing or not a date | Choose a check-out date |
| `check_out` | not after check-in | Check-out must be after check-in (exists) |
| `guests` | missing, not a number or not whole | Guests must be a whole number |
| `guests` | under 1 | At least 1 guest is required |

Errors that aren't about a single field are shown **above the button** (create) or **on the row** (edit/cancel/delete), as the API sends them:

| From | Status | Message shown |
|---|---|---|
| Capacity trigger (VG3) | 400 | This listing allows at most 4 guests |
| Time trigger (VG5) | 400 | Check-in date has already passed / This booking has already started and can no longer be changed |
| Exclusion constraint (VG2) | 409 | These dates are already booked |
| Insert policy | 403 | You can't book your own listing (only reachable via devtools / API) |
| Not logged in | 401 | "You're no longer logged in" + "Log in again" button, like `ListingForm` |
| API down / 5xx | 0 / 5xx | Something went wrong, try again |

In every error case the fields keep what the user typed.

## Cases

Users from `npm run seed`: anna owns Åre/Södermalm/Studio, erik owns Seaside/Haga/Malmö (1100 kr/night, max 4), sara is a guest. Plus `seed_past_booking.sql`.

**Must work**
- Logged out on Malmö: "Log in to book this stay" → log in → back on Malmö with the form (G9).
- sara on Malmö: email prefilled. Pick +60 → +63, 3 guests → preview "3 nights × 1100 kr = 3300 kr" (G11). Book → appears in "Your bookings" with 3300 kr.
- Change the dates in the form → the preview updates right away. Check-out not after check-in → no preview.
- sara edits that booking to +61 → +64 (overlaps its own old dates) → saved, new dates (VG2).
- sara edits only the email → saved, price unchanged (only `email` sent: check in the Network tab).
- sara cancels it → "Cancelled", only Delete left. Then books +61 → +64 again → works (cancelled doesn't block, VG2).
- sara deletes a booking → confirm → gone.
- erik on Malmö: "This is your listing", sees sara's bookings with her email, no buttons (VG1).
- anna on Malmö: sees only her own bookings, not sara's (VG1).
- Reload the page while logged in → no flash of the logged-out view.

**Must fail: shown under the field (G10)**
- With `novalidate` on the form (devtools): empty email, `guests` 0, `guests` empty, no dates → 400, each message under its field.
- Check-out before check-in (pick it, or `novalidate`) → "Check-out must be after check-in" under check-out.
- Invalid email (`novalidate`, "abc") → "Enter a valid email address".

**Must fail: shown above the button / on the row**
- 5 guests on Malmö (`novalidate`, or remove `max`) → 400 "This listing allows at most 4 guests" (VG3).
- Check-in yesterday (`novalidate`) → 400 "Check-in date has already passed" (VG5).
- sara books +60 → +63, then anna books +62 → +65 → 409 "These dates are already booked" (VG2). Same when editing into an overlap.
- sara on Seaside: the past booking shows "Started" and has no buttons (VG5). The 400 for editing/cancelling/deleting it is covered by the existing `api.http` calls.
- Logged out in another tab, then book → 401 → "Log in again".
- Backend stopped → "Something went wrong, try again".

## Where each rule lives

| Rule | Frontend | API | DB |
|---|---|---|---|
| Logged in to book (G9) | logged-out view links to login | `requireUser` → 401 | no grants for `anon` |
| Valid fields (G10) | `required`, `min`, `max`, `type` (UX only) | Zod → 400 with field messages | CHECK constraints |
| Nights + price (G11, VG6) | preview only | Zod drops `total_price` | `bookings_price` trigger computes and saves it |
| Ownership (VG1) | picks owner or guest view, hides buttons (UX only) | 403 / 404 mapping | RLS policies |
| No overlap (VG2) | shows the 409 | maps `23P01` → 409 | exclusion constraint |
| Capacity (VG3) | `max` on guests (UX only), shows the 400 | passes the trigger's message | `bookings_capacity` trigger |
| Time rules (VG5) | `min` on check-in, "Started" + no buttons (UX only, Stockholm date), shows the 400 | passes the trigger's message | `bookings_time` trigger |

## Types (G16)

In `lib/types.ts`:
- `Booking`: same fields as `Tables<'bookings'>` (id, listing_id, guest_id, email, check_in, check_out, guests, total_price, status `'active' | 'cancelled'`, created_at).
- `NewBooking = { email: string; check_in: string; check_out: string; guests: number }`: the body of POST.
- `BookingChanges = Partial<NewBooking>`: the body of an edit.

New `lib/bookings.ts`: `getBookings(listingId)`, `createBooking(listingId, booking)`, `updateBooking(id, changes)`, `cancelBooking(id)`, `deleteBooking(id)`, all via `apiFetch`. No `any`, no new casts.

## How it's tested

**API (`backend/tests/api.http`, `# Bookings`).** The status codes don't change. Each existing 400 call's comment gets its expected message, plus new 400 calls: `guests: 1.5`, `email` missing, `check_in` missing. Re-run the whole bookings section.

**Frontend:** click through every case above as sara, erik and anna. Bookings made along the way are deleted afterwards.

## Build steps

1. Check current docs: Zod custom messages on `z.email()` and `z.iso.date()` (ctx7).
2. Backend: messages in `fieldsSchema`. Update `api.http`, re-run the bookings section.
3. `lib/types.ts` + `lib/bookings.ts` + `lib/dates.ts` (`todayInStockholm`, `nightsBetween`).
4. `components/BookingForm.tsx`: create and edit mode, field errors, price preview.
5. `components/BookingSection.tsx`: the three views, loading/error, the list with its rows and buttons.
6. `app/listings/[id]/page.tsx`: replace the placeholder with `<BookingSection listing={listing} />`.
7. Click through the cases.

## Notes from building

- **Verified:** all 108 calls in `api.http` give the expected status, and each booking 400 returns the message from the table under the right field. All 47 browser checks of the cases above pass (headless Playwright, as sara, anna and erik; script kept outside the repo). `tsc`, `lint` and `next build` pass. Test bookings were deleted afterwards.
- **`api.http` can't be run with the httpyac CLI:** it doesn't understand REST Client's `{{name.response.body.$[0].id}}`, so every call that uses an earlier response fails before it's sent. It works in VS Code REST Client. For this check a small script ran the file with the same calls, order and cookies.
- **The button says "Cancel booking", not "Cancel"**, so it can't be confused with closing the edit form ("Stop editing").
- **"Log in again" logs out and goes to `/login?next=/listings/<id>`** in one click. `/listings/new` redirects by itself when the user disappears, but the detail page doesn't (logged-out visitors may see it), so the button does the redirect.
- **A 401 on Cancel / Delete** shows "You're no longer logged in. Reload the page and log in again." on the row (the spec only described the form's 401).
- **`key={user.id}` on the logged-in part:** when another user logs in, React throws away the old list and form instead of briefly showing the previous user's bookings. Tested: anna's form is prefilled with her own email after sara.
- **React's lint rule `react-hooks/set-state-in-effect`** rejected calling `loadBookings()` in the effect, even though it only sets state after `await`. The first load is now `getBookings(id).then(showResult)`, which the rule accepts.
- `FieldError` moved from `ListingForm` to `components/FieldError.tsx`, shared by both forms. `textButtonClass` added to `lib/styles.ts` for the small row buttons.
- **Open question:** the UI hides Edit on cancelled bookings, but the API and DB still allow editing a cancelled booking's fields directly. No criterion asks for it to be blocked. Left as is.
- **Leftover data, not from this feature:** the listings "asd", "Playwright cabin" and "Playwright loft" were created on 2026-11-03 before this feature started. Not deleted.
