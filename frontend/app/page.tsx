import { FilterBar } from '@/components/FilterBar'
import { ListingRow } from '@/components/ListingRow'
import { SortSelect } from '@/components/SortSelect'
import { getListings, toFilters } from '@/lib/listings'

// A server component: it fetches on the Next server, not in the browser. Listings are public, so no
// cookies are needed. While it waits, Next shows app/loading.tsx; if it throws, app/error.tsx (G13).
export default async function Home({ searchParams }: PageProps<'/'>) {
  const filters = toFilters(await searchParams)
  const result = await getListings(filters)

  // 400 = a filter the API rejected, e.g. a hand-typed /?maxPrice=abc. That's the user's input,
  // not a broken server, so it's shown here with the form, not as the error view.
  const invalidFilter = !result.ok && result.status === 400
  // Anything else (API down, 500): throw, and error.tsx takes over
  if (!result.ok && !invalidFilter) {
    throw new Error(`Could not load listings: ${result.error.error}`)
  }
  const listings = result.ok ? result.data : []

  return (
    <main className="mx-auto w-full max-w-4xl px-6 pt-8 pb-16">
      <h1 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl">Find a place to stay</h1>
      <FilterBar filters={filters} />

      <div className="mt-10">
        {invalidFilter ? (
          <p className="text-error">Invalid filter. Check the values or clear the filters.</p>
        ) : listings.length === 0 ? (
          <p className="text-fog">No places match these filters. Try a higher price or fewer guests, or clear the filters.</p>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="text-sm text-fog">
                {listings.length} {listings.length === 1 ? 'place' : 'places'}
              </p>
              {/* key: same reason as in FilterBar, so "Clear filters" also resets the dropdown */}
              <SortSelect key={JSON.stringify(filters)} filters={filters} />
            </div>
            <ul className="divide-y divide-moss border-y border-moss">
              {listings.map((listing) => (
                <ListingRow key={listing.id} listing={listing} />
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  )
}
