# Feature 5: Auth API (register, login, logout, me)

**Criteria:** G1, G2 (API part). The frontend part (pages + navbar, G3) is feature 8, a separate spec.

## What

Four routes that let a visitor create an account, log in, log out, and ask "who am I?". The session lives in **cookies** set by the API, so the login survives a reload (G2). The same setup is used by every later route to know who is calling.

| Method | Path | Body | Success |
|---|---|---|---|
| POST | `/auth/register` | `{ email, password }` | **201** `{ id, email }`, logged in (cookies set) |
| POST | `/auth/login` | `{ email, password }` | **200** `{ id, email }`, cookies set |
| POST | `/auth/logout` | – | **204**, cookies cleared |
| GET | `/auth/me` | – | **200** `{ id, email }` |

## Shared setup (used by all later features too)

- **One Supabase client per request**, made with `createServerClient` from `@supabase/ssr`, the **publishable key**, and the request's cookies (`getAll` reads the Cookie header, `setAll` writes `Set-Cookie` on the response). Never the service-role key, so RLS sees the real user.
- **`requireUser` middleware**: calls `supabase.auth.getUser()` (verifies the token with Supabase, unlike `getSession()` which only reads the cookie). No user → **401**. Otherwise puts `user` on the Hono context, typed.
- **CORS**: `credentials: true`, origin = `FRONTEND_ORIGIN` exactly (not `*`).
- **Cookies**: `httpOnly: true` (the frontend never talks to Supabase directly, so JS doesn't need to read them → protects the token from XSS), `sameSite: 'lax'`.

## Rules and where they live

| Rule | API | Supabase Auth | Why |
|---|---|---|---|
| Valid email, password ≥ 6 chars | Zod → 400 | also enforced (`weak_password`) | Clear error before calling Supabase; Supabase is the real guard |
| Email not already used | maps `user_already_exists` → 409 | unique email in `auth.users` | Only the DB can know it's taken |
| Wrong email/password | maps `invalid_credentials` → 401 | checks the hash | Passwords never touch our code beyond passing through |
| Who is logged in | `requireUser` → 401 | `getUser()` verifies the JWT | Don't trust a cookie we haven't verified |

Precondition: **"Confirm email" is off** (Auth → Providers → Email), so register logs the user in directly.

## Cases

**Must work**
- Register with a new email → 201, `Set-Cookie` present.
- `GET /auth/me` right after (same cookies) → 200 with that email.
- Logout → 204. `GET /auth/me` after → 401.
- Login with the same account → 200, then `/auth/me` → 200.

**Must fail**
- Register/login with `email: "not-an-email"` → 400.
- Register with `password: "123"` → 400.
- Register with missing body / not JSON → 400.
- Register with an email that already exists → 409.
- Login with the wrong password → 401.
- `GET /auth/me` without cookies → 401.

## How it's tested

An `.http` file (`backend/tests/api.http` or similar) with one call per case above, each with a comment giving the expected status. REST Client/httpyac keep cookies between calls, so register → me → logout → me works as a sequence.

## Notes from building

- All cases above verified (curl + `backend/tests/api.http`). The Supabase error codes were right: `user_already_exists`, `invalid_credentials`.
- The client type is `ReturnType<typeof createServerClient<Database>>` (in `src/types/hono.ts`), not `SupabaseClient<Database>`. `@supabase/ssr` has no ESM export map, so its types use the CommonJS copy of supabase-js while our code uses the ESM copy, and TS sees two unrelated classes.
- Supabase's cookie options allow `sameSite: true/false`, but Hono's `setCookie` doesn't, so `setAll` copies the fields one by one and always uses `'Lax'`.
- Sign-up also sets PKCE `code-verifier` cookies (the server client always uses PKCE). Harmless, and cleared on logout.
- An unexpected Supabase error is thrown and becomes a 500 via `app.onError`.

## Build steps

1. Check "Confirm email" is off in the dashboard.
2. `src/lib/supabase.ts`: function that takes the Hono context and returns a typed `SupabaseClient<Database>` for this request.
3. `src/middleware/requireUser.ts`: the 401 check, sets `c.set('user', ...)`.
4. `src/routes/auth.ts`: the four routes, Zod schema shared by register/login, error-code → status mapping.
5. Mount the routes and CORS in `src/index.ts`.
6. Write the `.http` calls and run through the cases.
