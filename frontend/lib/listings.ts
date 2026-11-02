import { apiFetch, type ApiResult } from './api'
import type { Listing, ListingFilters } from './types'

// The keys the API understands. Anything else in the URL is ignored.
const FILTER_KEYS = ['location', 'maxPrice', 'guests', 'sort'] as const

// Turns the page's searchParams into our filters. A value can be an array when a key is
// repeated in the URL (?guests=1&guests=2), so we keep only the first one.
export function toFilters(searchParams: Record<string, string | string[] | undefined>): ListingFilters {
  const filters: ListingFilters = {}
  for (const key of FILTER_KEYS) {
    const value = searchParams[key]
    filters[key] = Array.isArray(value) ? value[0] : value
  }
  return filters
}

// G5, G8: the filtering and sorting happen in the API's DB query. We only build the query string.
export function getListings(filters: ListingFilters): Promise<ApiResult<Listing[]>> {
  const query = new URLSearchParams()
  for (const key of FILTER_KEYS) {
    const value = filters[key]?.trim()
    // An empty input still arrives as "location=". The API rejects an empty value with 400,
    // so an empty field means "no filter" and is left out.
    if (value) query.set(key, value)
  }
  const queryString = query.toString()
  return apiFetch<Listing[]>(queryString ? `/listings?${queryString}` : '/listings')
}

export function getListing(id: string): Promise<ApiResult<Listing>> {
  // encodeURIComponent: the id comes from the URL, so it can contain anything
  return apiFetch<Listing>(`/listings/${encodeURIComponent(id)}`)
}
