import { apiFetch, type ApiResult } from './api'
import type { Listing, MyBooking } from './types'

// Both run in the browser, so the session cookies go along (apiFetch sends credentials: 'include').
// The API answers 401 without a login.

// The listings the logged-in user owns, newest first
export function getMyListings(): Promise<ApiResult<Listing[]>> {
  return apiFetch<Listing[]>('/me/listings')
}

// The bookings the logged-in user made as a guest, by check-in.
// Not the bookings other guests made on their listings: those are on each listing's page.
export function getMyBookings(): Promise<ApiResult<MyBooking[]>> {
  return apiFetch<MyBooking[]>('/me/bookings')
}
