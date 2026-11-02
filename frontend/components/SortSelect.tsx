'use client' // onChange runs in the browser, so this has to be a client component

import Form from 'next/form'
import type { ListingFilters } from '@/lib/types'

// The sort dropdown above the list. Its own small GET form that submits as soon as an option is
// picked, so there's no button. The sorting itself happens in the API, in the DB query (G8).
export function SortSelect({ filters }: { filters: ListingFilters }) {
  return (
    <Form action="/" className="flex items-center gap-2 text-sm">
      {/* A GET form only sends its own fields. These hidden ones keep the current filters,
          so sorting doesn't throw away what the user searched for. */}
      {filters.location && <input type="hidden" name="location" value={filters.location} />}
      {filters.guests && <input type="hidden" name="guests" value={filters.guests} />}
      {filters.maxPrice && <input type="hidden" name="maxPrice" value={filters.maxPrice} />}

      <label htmlFor="sort" className="text-fog">Sort</label>
      <select
        id="sort"
        name="sort"
        defaultValue={filters.sort ?? ''}
        // requestSubmit() submits the form the same way as clicking a submit button would
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-moss bg-night px-2 py-1 text-birch"
      >
        <option value="">Newest first</option>
        <option value="price_asc">Price, low to high</option>
        <option value="price_desc">Price, high to low</option>
      </select>
    </Form>
  )
}
