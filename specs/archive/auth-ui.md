# Feature 8: Auth UI (register, login, logout pages + navbar)

**Criteria:** G1, G2, G3 (frontend part). The API part is done (`specs/archive/auth-api.md`).

## What

- `/register` and `/login` pages, each with an email + password form.
- A navbar on every page that shows who is logged in and the right links.
- The login survives a page reload (G2), because the session lives in the API's httpOnly cookies and the app asks `GET /auth/me` on load.

## How the frontend knows who is logged in

**Decision: in the browser, with a React context.**

- `AuthProvider` (client component, rendered in `app/layout.tsx`) calls `GET /auth/me` once on load.
  200 → `user = { id, email }` · 401 → `user = null` · still waiting → `loading = true`.
- It exposes `user`, `loading`, `login()`, `register()`, `logout()` through a `useAuth()` hook.
- Every fetch to the API goes through one helper with `credentials: 'include'`, or the browser won't send (or store) the cookies.
- The API URL comes from `NEXT_PUBLIC_API_URL` in `frontend/.env.local` (+ `.env.example`).

Why not check on the Next server instead? It's possible (cookies are shared across ports on `localhost`), but then Next has to forward cookies to the API and relay `Set-Cookie` back. The browser approach has one path for cookies: browser ↔ API. Cost: the navbar shows a short loading state on first load.

## Navbar (G3)

| State | Shows |
|---|---|
| loading | brand only (no links, so it doesn't flash "Log in" for a logged-in user) |
| logged out | brand · "Log in" · "Register" |
| logged in | brand · the user's email · "Log out" |

("Create listing" and "My bookings" links get added by their own features.)

## Forms

| | Register | Login |
|---|---|---|
| On success | context gets the user → go to `/` | same |
| 400 | show the field errors from `details` under each field | same |
| 409 | "Email is already registered" | – |
| 401 | – | "Wrong email or password" |
| API down / 500 | "Something went wrong, try again" | same |

- While submitting: button disabled with "…", so a double click doesn't send twice.
- HTML attributes (`type="email"`, `required`, `minLength={6}`) give quick feedback, but **the API is the real check**. Calling the API directly skips the browser, so the rule can't live only here.
- Visiting `/login` or `/register` while logged in → redirect to `/`.
- Logout: `POST /auth/logout` → context sets `user = null` → go to `/`.

## Where each rule lives

| Rule | Frontend | API | Supabase |
|---|---|---|---|
| Valid email, password ≥ 6 | HTML attributes (UX only) | Zod → 400 | Auth also checks |
| Email unique | shows the 409 | maps → 409 | unique in `auth.users` |
| Correct password | shows the 401 | maps → 401 | checks the hash |
| Who is logged in | asks `/auth/me`, never decides itself | `getUser()` | verifies the JWT |

## Types (G16)

`frontend/lib/types.ts`: `User = { id: string; email: string | undefined }`, `ApiError = { error: string; details?: Record<string, string[]> }`. Same shapes as the API sends.

## Cases (click-through)

**Must work**
- Register a new account → lands on `/`, navbar shows the email + "Log out".
- Reload the page → still logged in (G2).
- Log out → navbar shows "Log in" + "Register". Reload → still logged out.
- Log in with that account → navbar shows the email again.

**Must fail, with a clear message in the form**
- Register with an email that exists → "Email is already registered".
- Log in with the wrong password → "Wrong email or password".
- Password "123" (remove `minLength` in devtools, or rely on the API) → field error under password.
- Backend stopped → "Something went wrong", no crash.

## Notes from building

- All cases above verified with a headless-browser click-through, plus: `/login` while logged in redirects to `/`; the auth cookie is `httpOnly` and `document.cookie` is empty in the page.
- Login and register share one `components/AuthForm.tsx` (`mode` prop); the pages are one line each.
- After a successful submit the form doesn't navigate itself: the context gets the user, and the "logged in → go home" effect does the redirect. One path for both cases.
- `lib/api.ts` has the only cast (`body as T`): runtime data from the API can't be checked by TS. Error bodies are checked with a type guard (`isApiError`).

## Build steps

1. `frontend/.env.local` + `.env.example` with `NEXT_PUBLIC_API_URL=http://localhost:3001`.
2. `lib/types.ts` and `lib/api.ts` (fetch helper with `credentials: 'include'`).
3. `components/AuthProvider.tsx` (context + `useAuth`), wrap `children` in `app/layout.tsx`.
4. `components/Navbar.tsx`, render it in the layout.
5. `app/register/page.tsx` and `app/login/page.tsx` (client components with the form).
6. Click through the cases above.
