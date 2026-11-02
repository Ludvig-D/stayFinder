import Form from 'next/form'
import Link from 'next/link'
import type { ListingFilters } from '@/lib/types'

// One segment of the search bar: a small label on top, the field under it. The whole segment is
// the <label>, so clicking anywhere in it focuses the field. focus-within lights up the segment
// that has focus, which is why the field itself doesn't need its own focus outline.
const segmentClass = 'flex flex-1 cursor-text flex-col gap-0.5 rounded-xl px-6 py-3 focus-within:bg-pine sm:rounded-full'
const labelTextClass = 'text-xs font-semibold'
const fieldClass = 'w-full bg-transparent text-birch placeholder:text-fog focus-visible:outline-none'

// A GET form: submitting it puts the fields in the URL (/?location=stock&maxPrice=900),
// and the page reads them from there. The URL is the state, so reload and back keep the filters.
// next/form's <Form> does the same as a plain <form method="get">, but navigates client-side.
export function FilterBar({ filters }: { filters: ListingFilters }) {
  return (
    // key: the inputs are uncontrolled (defaultValue), so React keeps what was typed when the URL
    // changes. A new key on every new set of filters remounts the form, so "Clear" empties the fields.
    <Form key={JSON.stringify(filters)} action="/">
      {/* Sort is picked in SortSelect above the list. Sending it along here keeps it when searching. */}
      {filters.sort && <input type="hidden" name="sort" value={filters.sort} />}

      {/* Phone: segments stacked in a rounded box. sm and up: one row in a pill. */}
      <div className="flex flex-col rounded-2xl border border-moss sm:flex-row sm:items-center sm:rounded-full">
        <label className={segmentClass}>
          <span className={labelTextClass}>Where</span>
          <input name="location" defaultValue={filters.location} placeholder="Search destinations" className={fieldClass} />
        </label>

        {/* type and min are only quick feedback. The API is the real check */}
        <label className={`${segmentClass} border-t border-moss sm:border-t-0 sm:border-l`}>
          <span className={labelTextClass}>Guests</span>
          <input name="guests" type="number" min={1} defaultValue={filters.guests} placeholder="Add guests" className={fieldClass} />
        </label>

        <label className={`${segmentClass} border-t border-moss sm:border-t-0 sm:border-l`}>
          <span className={labelTextClass}>Max price</span>
          <input name="maxPrice" type="number" min={1} defaultValue={filters.maxPrice} placeholder="Any price" className={fieldClass} />
        </label>

        {/* Round icon button from sm up; on a phone a full-width button that also says "Search" */}
        <button
          type="submit"
          aria-label="Search"
          className="m-2 flex items-center justify-center gap-2 rounded-full bg-cloudberry py-3 font-semibold text-night hover:brightness-110 sm:size-12 sm:shrink-0 sm:py-0"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <span className="sm:hidden">Search</span>
        </button>
      </div>

      <div className="mt-3 flex justify-end">
        <Link href="/" className="text-sm text-fog hover:text-birch hover:underline">
          Clear filters
        </Link>
      </div>
    </Form>
  )
}
