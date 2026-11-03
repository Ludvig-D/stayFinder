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

// The filters as they arrive in the URL. All strings: this is raw text the user typed,
// and the API is what checks it (Zod → 400), so the frontend doesn't validate it a second time.
export type ListingFilters = {
  location?: string
  maxPrice?: string
  guests?: string
  sort?: string
}
