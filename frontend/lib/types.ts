// Same shapes as the API sends (backend/src/routes/auth.ts)

export type User = {
  id: string
  email: string | undefined
}

export type Credentials = {
  email: string
  password: string
}

// Every error response from the API. `details` is only there on 400: field name → messages.
export type ApiError = {
  error: string
  details?: Record<string, string[]>
}

// Same fields as Tables<'listings'> in the backend (backend/src/types/database.types.ts).
// Written out here because the frontend is its own npm package and can't import the backend's file.
export type Listing = {
  id: string
  owner_id: string
  title: string
  description: string | null
  location: string
  price_per_night: number
  max_guests: number
  created_at: string
}

// The body of POST /listings. No id, owner_id or created_at: the DB sets those itself.
// An empty description is sent as "", and the API saves it as null.
export type NewListing = {
  title: string
  description: string
  location: string
  price_per_night: number
  max_guests: number
}

// Same fields as Tables<'bookings'> in the backend. The DB only allows these two statuses
// (a CHECK constraint), so the type says so too, instead of a plain string.
export type BookingStatus = 'active' | 'cancelled'

export type Booking = {
  id: string
  listing_id: string
  guest_id: string
  email: string
  check_in: string // YYYY-MM-DD
  check_out: string // YYYY-MM-DD
  guests: number
  total_price: number // computed by the DB (VG6)
  status: BookingStatus
  created_at: string
}

// The body of POST /listings/:id/bookings. No total_price: the DB computes it (VG6),
// and no guest_id: the DB sets it to the logged-in user (VG1).
export type NewBooking = {
  email: string
  check_in: string
  check_out: string
  guests: number
}

// The body of an edit: only the fields that changed (see BookingForm)
export type BookingChanges = Partial<NewBooking>

// The filters as they arrive in the URL. All strings: this is raw text the user typed,
// and the API is what checks it (Zod → 400), so the frontend doesn't validate it a second time.
export type ListingFilters = {
  location?: string
  maxPrice?: string
  guests?: string
  sort?: string
}
