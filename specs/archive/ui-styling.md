# UI styling pass

## What
A visual pass over the frontend that exists so far. **No new criteria and no behaviour change**: same routes, same fetches, same form field names, same error handling. Only markup, Tailwind classes, `globals.css` and fonts change.

Status: done (2026-11-02). Built twice: the first version had the filters as a sentence, which the user replaced with the search bar below.

Covers: navbar, home (`/`, filter bar + listing list), detail page, login/register, and the loading, error and not-found views.

## Design plan
**Subject:** booking a place to stay in Sweden (prices in kr). The listings have no photos, so the design leans on type and layout instead.

**Colour**: **dark only** (decided by the user): one palette, no light mode, no `prefers-color-scheme` switch. A Nordic night: deep spruce instead of plain black.
| Name | Hex | Use |
|---|---|---|
| Night | `#12211C` | page background |
| Pine | `#1A2E27` | raised surfaces: inputs, placeholders |
| Moss | `#2E453C` | borders and dividers |
| Birch | `#E8ECE6` | text, primary buttons |
| Fog | `#9DAFA6` | secondary text |
| Lake | `#7FB3D5` | links, focus ring |
| Cloudberry | `#F0B43C` | one accent: prices and the filter values |
| Error | `#F2827A` | form errors |

**Type:** *Familjen Grotesk* (Google Fonts, made by a Stockholm studio) for everything, replacing Geist. Prices use tabular figures so the numbers line up.

**Layout:**
- **The search bar** (changed after the first build: the user preferred an Airbnb-style bar over the sentence). One rounded pill, split into segments by thin dividers. Each segment has a small visible label on top and the input under it:
  ```
  ╭──────────────────────────┬────────────────┬────────────────────┬─────╮
  │ Where                    │ Guests         │ Max price          │ (🔍) │
  │ Search destinations      │ Add guests     │ Any price          │     │
  ╰──────────────────────────┴────────────────┴────────────────────┴─────╯
                                                             Clear filters

  6 places                                          Sort: [Newest first ▾]
  ───────────────────────────────────────────────────────────────────────
  Seaside house                                                   1800 kr
  ```
  - No "When" segment: searching by dates is VG7, which we didn't choose.
  - **Sort is a small dropdown above the list**, on the right of "6 places" (user's choice). How it works:
    - It's its own small GET form (`SortSelect`). Choosing an option submits it straight away, so there's no extra button. That needs one `onChange` in the browser, so `SortSelect` is a small client component (`'use client'`): `onChange` calls `form.requestSubmit()`.
    - So sorting doesn't drop the filters, the sort form carries the current `location`, `guests` and `maxPrice` as hidden inputs. The other way round, the search bar carries the current `sort` as a hidden input, so searching keeps the sort.
    - Only shown when there are listings (with no results there is nothing to sort).
  - The search button is a round cloudberry button with a magnifier icon (inline SVG) and `aria-label="Search"`.
  - The segment with focus gets a lighter background (Pine). Number inputs hide the browser's up/down arrows.
  - The labels are real `<label>`s (visible now, not screen-reader-only).
  - "Clear filters" is a small link under the bar, on the right.
  - On a phone the pill becomes a rounded box with the segments stacked, and the button turns into a full-width "Search" button at the bottom.
  - It is still the same GET form with the same `name`s (`location`, `guests`, `maxPrice`, `sort`), and the URL is still the state, so G5/G8 behave exactly as before. The sorting itself still happens in the API (G8).
  - The page gets a visible `h1` above the bar again: "Find a place to stay".
- The listings become **rows, not cards**: title, location and guests on the left, price on the right, with a divider between rows. `ListingCard` is renamed `ListingRow`.
- Detail page: large title, location under it, a fact strip (price / max guests), then the description. The booking placeholder stays.
- Login/register: a narrow, left-aligned form. Errors sit under their field.
- Shared button/input classes live in `lib/styles.ts`, so every button looks the same.
- Everything is left-aligned. Visible keyboard focus, works at mobile width, no decorative animation.

## How it's verified
- `npx tsc --noEmit` and `npm run lint` pass.
- Re-run the click-through from `specs/archive/listings-ui.md` and `auth-ui.md`: filters, sorting, clear, invalid filter, empty result, detail, not-found, error view (API stopped), login/logout/register. Everything behaves exactly as before.
- Check at mobile width.

## What differed from the plan
- The sentence filter was replaced by an Airbnb-style search bar, and sort moved to a dropdown above the list (`SortSelect`, a small client component).
- The global `:focus-visible` outline had to go in `@layer base`: outside a layer it beat Tailwind's `focus-visible:outline-none`, so the search bar fields showed a blue box.
- Gotcha: the dev server sometimes keeps serving an old `globals.css`. Fix: stop `npm run dev`, delete `.next/`, start again.
- Verified: typecheck, lint, filters/sort/hidden fields checked against the running app, and the look checked by the user in the browser.
