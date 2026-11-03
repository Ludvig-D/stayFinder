import { apiFetch, type ApiResult } from './api'
import type { Booking, BookingChanges, NewBooking } from './types'

// All of these run in the browser, so the session cookies go along (apiFetch sends credentials: 'include').
// The API needs a logged-in user for every bookings call (401 otherwise).

// G12, VG1: no filtering here. RLS decides: a guest gets their own bookings, the owner gets all of them.
export function getBookings(listingId: string): Promise<ApiResult<Booking[]>> {
  return apiFetch<Booking[]>(`/listings/${encodeURIComponent(listingId)}/bookings`)
}

// G9. 201 with the new booking (and the price the DB computed), 400 / 403 / 409 otherwise.
export function createBooking(listingId: string, booking: NewBooking): Promise<ApiResult<Booking>> {
  return apiFetch<Booking>(`/listings/${encodeURIComponent(listingId)}/bookings`, {
    method: 'POST',
    body: booking
  })
}

// G12: edit. Only send what changed, see BookingForm for why.
export function updateBooking(id: string, changes: BookingChanges): Promise<ApiResult<Booking>> {
  return apiFetch<Booking>(`/bookings/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes })
}

// G12: cancelling is an edit of the status. The row stays, and its dates are free again (VG2).
export function cancelBooking(id: string): Promise<ApiResult<Booking>> {
  return apiFetch<Booking>(`/bookings/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: { status: 'cancelled' }
  })
}

// G12: 204, nothing to return
export function deleteBooking(id: string): Promise<ApiResult<null>> {
  return apiFetch<null>(`/bookings/${encodeURIComponent(id)}`, { method: 'DELETE' })
}
