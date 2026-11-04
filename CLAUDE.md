# StayFinder

An individual, graded school assignment: a full-stack booking service (G/VG grading, with an oral code review on 2026-11-05). **Read `PROJECT.md` first.** It has the criteria checklist, the decisions made so far, the feature order, the schedule and useful notes.

Stack: Hono (TypeScript, Node) + Zod · Supabase (Postgres, Auth, RLS) · Next.js App Router + TypeScript.
Layout: one repo with `backend/`, `frontend/`, `supabase/` (SQL), `specs/` (one file per feature).
Target: all of G1–G16, plus VG1, VG2, VG3, VG5, VG6.

## How we work

Spec-driven development, **one feature at a time**. The user decides what gets built through the spec; Claude builds it:

1. Pick the next feature (order in `PROJECT.md` §5).
2. Claude drafts a short spec in `specs/<feature>.md` and the user approves or changes it: what it does (criteria IDs), cases that must work and must fail (with status codes), where each rule lives (frontend / API / DB) and why, and how it's tested.
3. Claude builds it, exactly as the spec says.
4. Verify it against the spec: test calls plus a click-through in the app.
5. Update the spec if reality differed, tick the criteria in `PROJECT.md` §3, add a line to the progress log, and move the spec to `specs/archive/`.

## Claude's role

- **The user specs, Claude builds.** Claude drafts the spec, surfaces the decisions the user has to make, and builds only what the approved spec says.
- **No code before an explicit "build it".** When the user gives feedback on a spec (a change, a preference, a correction), update the spec and show it again. Don't treat feedback as approval. Only edit code after the user has clearly confirmed that the current spec should be built.
- The user must be able to **explain every line at the oral exam**. Prefer plain, readable code over clever code, comment the *why*, and after building point out the parts worth reading closely (e.g. why a rule belongs in the API, the DB or both).
- Stay on the current feature. Don't plan or build features nobody asked for.
- Don't write big up-front specs. Specs are short and per feature, and the user drives them.
- Point out when something risks failing a criterion (e.g. using the service-role key, which bypasses RLS).
- Check current docs (ctx7) for Hono, Supabase, Next.js and Zod rather than relying on memory.

## Conventions

- TypeScript `strict` in both projects. No `any`. All data typed (G16).
- Every business rule is enforced in the database (RLS, constraints, triggers). The API validates input and maps errors to clear HTTP status codes (200/201/204/400/401/403/404/409).
- The API uses the Supabase publishable key plus the user's session cookies, **never the service-role key**.
- Every rule gets a passing and a failing call in the API test file.
- Secrets go in `.env` files (git-ignored). Commit `.env.example` only.

## Commands

Run each from its own folder (npm, no workspaces):

- Backend (`backend/`, http://localhost:3001): `npm run dev` · `npm run build` · typecheck `npx tsc --noEmit`
- Frontend (`frontend/`, http://localhost:3000): `npm run dev` · `npm run build` · `npm run lint` · typecheck `npx tsc --noEmit`
- Supabase types: `npx supabase gen types typescript --project-id <id>` (run in `backend/`)
- API tests: `backend/tests/stayfinder.postman_collection.json` (Postman collection v2.1). Postman desktop: Import → Run collection, or `npx newman run tests/stayfinder.postman_collection.json` in `backend/`. Run top to bottom on a fresh seed with the backend running. Each request checks its expected status with `pm.test`; values for later calls are saved with `pm.collectionVariables.set`

Git: `CLAUDE.md`, `PROJECT.md`, `specs/`, `.claude/` and `.mcp.json` are committed, so the spec-driven process is part of the repo.
