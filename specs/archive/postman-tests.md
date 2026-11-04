# Spec: API test calls as a Postman collection

**Status:** built 2026-11-04. Newman: 125 requests, 156 assertions, 0 failed, two runs in a row without reseeding.

## What and why

Replace `backend/tests/api.http` (httpyac) with a Postman collection. This covers the §4 deliverable "a file of test calls that shows the rules work" for all criteria.

Why: the `.http` file only has the expected status in a comment, so you have to read every response yourself to see whether it passed. In Postman each request checks its own status, and the Collection Runner shows a green or red row per call. The teacher can import the file and run it with one click.

No API, DB or frontend changes.

## What gets built

- `backend/tests/stayfinder.postman_collection.json` (Collection format v2.1). It has the same 125 calls in the same order, in folders **Auth / Listings / Bookings / My page**. Each request keeps the name it has today, e.g. `FAIL: register with an invalid email -> 400`.
- **One test per request** checks the expected status, written as `pm.test("Status 400", () => pm.response.to.have.status(400))`. Calls that check more today (the price on a booking, the Stockholm filter) also get one extra plain `pm.expect` line for that value.
- **Chaining**: the 11 `# @name` calls (`register`, `haga`, `malmo`, `saraBooking`, ...) become a post-response script that saves just the id or email we need, e.g. `pm.collectionVariables.set("malmoId", json[0].id)`. Later calls use `{{malmoId}}`.
- **Dates**: one collection-level pre-request script sets `today+N` variables (`{{d60}}`, `{{d81}}`, `{{dMinus1}}`, ...). Postman has no built-in "today + N days" variable. `{{$timestamp}}` stays as it is (Postman supports it).
- **Cookies**: nothing to add. Postman and Newman keep the session cookie between requests, the way httpyac does now.
- `baseUrl` is a collection variable (`http://localhost:3001`), so no environment file is needed.

## How it's run

- **Postman app**: Import the file, then Run collection. Seed first (the same 3 steps as now, `backend/README.md`), with the backend running.
  Note: Postman on the web can't reach `localhost` without the desktop agent, so use the desktop app.
- **Terminal**: `npx newman run tests/stayfinder.postman_collection.json` in `backend/`. This prints a table of passed and failed tests. Claude uses it to verify.

## Done when

- All 125 requests pass in Newman on a fresh seed, and a second run without reseeding also passes (or the calls that can't be re-run are noted, as today).
- `api.http` is removed. `CLAUDE.md` (Commands), `backend/README.md` and `PROJECT.md` §7/§8 point to the collection instead.

## Decisions made

- **`api.http` is replaced**, not kept next to the collection. One test file to keep in sync and to explain at the oral exam (user, 2026-11-04).
