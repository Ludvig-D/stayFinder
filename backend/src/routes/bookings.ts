import { Hono, type Context } from 'hono'
import { z } from 'zod'
import type { PostgrestError } from '@supabase/supabase-js'
import type { AppEnv, Supabase } from '../types/hono.js'
import type { Tables } from '../types/database.types.js'
import { requireUser } from '../middleware/requireUser.js'
import { idSchema, invalid, readBody } from '../lib/http.js'

// The DB row type from the generated types (G16)
type Booking = Tables<'bookings'>

// G10: the simple rules on one booking. Capacity (VG3), overlap (VG2) and "not in the past" (VG5)
// are NOT here: they need the listing, the other bookings or today's date, which only the DB has reliably.
// No total_price: Zod drops unknown keys, and the DB computes the price itself (VG6).
// The messages are written for people: the booking form shows them as they are, under each field.
// The message on the type itself (z.email('…')) is used when the field is missing or the wrong type.
const fieldsSchema = z.object({
  email: z.email('Enter a valid email address'),
  check_in: z.iso.date('Choose a check-in date'), // YYYY-MM-DD
  check_out: z.iso.date('Choose a check-out date'),
  // z.int() rejects 1.5 and "2" (a string) as well as a missing value
  guests: z.int('Guests must be a whole number').min(1, 'At least 1 guest is required')
})

// YYYY-MM-DD strings sort like the dates they stand for, so > compares them correctly.
// Only checked when both dates are sent; on a PATCH with one date, the DB's CHECK is the backstop.
function datesInOrder(booking: { check_in?: string; check_out?: string }) {
  return !booking.check_in || !booking.check_out || booking.check_out > booking.check_in
}
const datesError = { message: 'Check-out must be after check-in', path: ['check_out'] }

const createSchema = fieldsSchema.refine(datesInOrder, datesError)

// PATCH that edits: any of the fields, but at least one
const editSchema = fieldsSchema
  .partial()
  .refine((fields) => Object.keys(fields).length > 0, { message: 'Send at least one field to update' })
  .refine(datesInOrder, datesError)

// PATCH that cancels: only { status: 'cancelled' }. No un-cancelling, and strict so it can't be mixed with an edit.
const cancelSchema = z.strictObject({ status: z.literal('cancelled') })

// A body with "status" is a cancel, anything else is an edit
function parseUpdate(body: unknown) {
  const isCancel = typeof body === 'object' && body !== null && 'status' in body
  return isCancel ? cancelSchema.safeParse(body) : editSchema.safeParse(body)
}

function notFound(c: Context, what: 'Listing' | 'Booking') {
  return c.json({ error: `${what} not found` }, 404)
}

// DB errors that any booking write can hit. The DB holds the rules; this only picks the status code.
function writeError(c: Context, error: PostgrestError) {
  // VG2: the exclusion constraint found an active booking on overlapping dates
  if (error.code === '23P01') return c.json({ error: 'These dates are already booked' }, 409)
  if (error.code === '23514') {
    // Our triggers (VG3, VG5) raise messages written for the user, so they're passed on.
    // A plain CHECK constraint's message names the constraint, so it gets a generic one instead.
    const message = error.message.includes('violates check constraint') ? 'Invalid data' : error.message
    return c.json({ error: message }, 400)
  }
  throw error
}

// RLS hides bookings you may not change, so an update/delete changes 0 rows without an error.
// If you can still see the booking, you're the listing owner (read-only, VG1) → 403.
// If you can't see it, it's someone else's or doesn't exist → 404, so a private booking isn't revealed.
async function notOwnedOrMissing(c: Context, supabase: Supabase, id: string) {
  const { data, error } = await supabase.from('bookings').select('id').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? c.json({ error: 'Only the guest can change a booking' }, 403) : notFound(c, 'Booking')
}

// Mounted at '/', so it can serve both /listings/:id/bookings and /bookings/:id.
// requireUser goes on each route rather than use('*'), which would catch every path in the app.
export const bookings = new Hono<AppEnv>()

// G12, VG1: no filter on guest_id here. The select policy decides: a guest gets their own, the owner gets all.
bookings.get('/listings/:id/bookings', requireUser, async (c) => {
  const listingId = idSchema.safeParse(c.req.param('id'))
  if (!listingId.success) return notFound(c, 'Listing')
  const supabase = c.get('supabase')

  // An empty list could mean "no bookings" or "no such listing". Listings are public, so we can check.
  const { data: listing, error: listingError } = await supabase
    .from('listings').select('id').eq('id', listingId.data).maybeSingle()
  if (listingError) throw listingError
  if (!listing) return notFound(c, 'Listing')

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('listing_id', listingId.data)
    .order('check_in', { ascending: true })
  if (error) throw error
  return c.json<Booking[]>(data, 200)
})

// G9: guest_id is set by the DB (default auth.uid()), and the price by the bookings_price trigger
bookings.post('/listings/:id/bookings', requireUser, async (c) => {
  const listingId = idSchema.safeParse(c.req.param('id'))
  if (!listingId.success) return notFound(c, 'Listing')
  const parsed = createSchema.safeParse(await readBody(c.req))
  if (!parsed.success) return invalid(c, parsed.error)

  const { data, error } = await c.get('supabase')
    .from('bookings')
    // The generated type requires total_price, but the bookings_price trigger overwrites it (VG6)
    .insert({ ...parsed.data, listing_id: listingId.data, total_price: 0 })
    .select()
    .single()
  if (error) {
    // Insert policy: you can't book your own listing
    if (error.code === '42501') return c.json({ error: 'You can\'t book your own listing' }, 403)
    // bookings_price found no listing with that id
    if (error.code === '23503') return notFound(c, 'Listing')
    return writeError(c, error)
  }
  return c.json<Booking>(data, 201)
})

// G12: edit or cancel. The update policy only matches the guest's own bookings (VG1).
bookings.patch('/bookings/:id', requireUser, async (c) => {
  const id = idSchema.safeParse(c.req.param('id'))
  if (!id.success) return notFound(c, 'Booking')
  const parsed = parseUpdate(await readBody(c.req))
  if (!parsed.success) return invalid(c, parsed.error)

  const { data, error } = await c.get('supabase')
    .from('bookings')
    .update(parsed.data)
    .eq('id', id.data)
    .select()
    .maybeSingle()
  if (error) return writeError(c, error)
  if (!data) return notOwnedOrMissing(c, c.get('supabase'), id.data)
  return c.json<Booking>(data, 200)
})

bookings.delete('/bookings/:id', requireUser, async (c) => {
  const id = idSchema.safeParse(c.req.param('id'))
  if (!id.success) return notFound(c, 'Booking')

  // .select() returns the deleted rows, so we can see whether RLS let anything through
  const { data, error } = await c.get('supabase').from('bookings').delete().eq('id', id.data).select('id')
  if (error) return writeError(c, error) // VG5: bookings_time refuses a started booking
  if (data.length === 0) return notOwnedOrMissing(c, c.get('supabase'), id.data)
  return c.body(null, 204)
})
