import { Hono, type Context } from 'hono'
import { z } from 'zod'
import type { PostgrestError } from '@supabase/supabase-js'
import type { AppEnv, Supabase } from '../types/hono.js'
import type { Tables } from '../types/database.types.js'
import { requireUser } from '../middleware/requireUser.js'
import { idSchema, invalid, readBody } from '../lib/http.js'

// The DB row type from the generated types, so the API can't drift from the table (G16)
type Listing = Tables<'listings'>

// Same limits as the DB's CHECK constraints (plus lengths), checked here first for a clear 400.
// No owner_id: Zod drops unknown keys, and the DB sets owner_id = auth.uid() itself.
// The messages are written for people: the frontend shows them as they are, under each field.
// The message on the type itself (z.string('…')) is used when the field is missing or the wrong type.
const createSchema = z.object({
  // trim() runs before min(1), so a title of only spaces counts as empty
  title: z.string('Title is required').trim()
    .min(1, 'Title is required')
    .max(100, 'Title can be at most 100 characters'),
  // An empty description is saved as null, so "no description" has only one form
  description: z.string().trim()
    .max(1000, 'Description can be at most 1000 characters')
    .nullable().transform((value) => value || null).optional(),
  location: z.string('Location is required').trim()
    .min(1, 'Location is required')
    .max(100, 'Location can be at most 100 characters'),
  // z.int() rejects 1.5 and "500" (a string) as well as a missing value
  price_per_night: z.int('Price must be a whole number').min(1, 'Price must be at least 1 kr'),
  max_guests: z.int('Max guests must be a whole number').min(1, 'Max guests must be at least 1')
})

// PATCH: any of the create fields, but at least one, otherwise there's nothing to update
const updateSchema = createSchema.partial().refine((fields) => Object.keys(fields).length > 0, {
  message: 'Send at least one field to update'
})

// Query params always arrive as strings, so the numbers are coerced
const querySchema = z.object({
  location: z.string().trim().min(1).optional(),
  maxPrice: z.coerce.number().int().min(1).optional(),
  guests: z.coerce.number().int().min(1).optional(),
  sort: z.enum(['price_asc', 'price_desc']).optional()
})

function notFound(c: Context) {
  return c.json({ error: 'Listing not found' }, 404)
}

// Errors from the DB on insert/update. Zod should catch bad data first, the DB is the backstop.
function writeError(c: Context, error: PostgrestError) {
  if (error.code === '23514') return c.json({ error: 'Invalid data' }, 400) // check_violation
  if (error.code === '42501') return c.json({ error: 'Not allowed' }, 403) // RLS said no
  throw error
}

// RLS hides rows the user doesn't own, so an update/delete on them changes 0 rows without an error.
// Listings are public, so we can look the row up to tell "not yours" (403) from "doesn't exist" (404).
async function notOwnedOrMissing(c: Context, supabase: Supabase, id: string) {
  const { data, error } = await supabase.from('listings').select('id').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? c.json({ error: 'You can only change your own listings' }, 403) : notFound(c)
}

export const listings = new Hono<AppEnv>()

// G4, G5, G8: filters and sorting run in the DB query, not in JS afterwards
listings.get('/', async (c) => {
  const parsed = querySchema.safeParse(c.req.query())
  if (!parsed.success) return invalid(c, parsed.error)
  const { location, maxPrice, guests, sort } = parsed.data

  let query = c.get('supabase').from('listings').select('*')
  if (location) query = query.ilike('location', `%${location}%`) // part of the name, any case
  if (maxPrice) query = query.lte('price_per_night', maxPrice)
  if (guests) query = query.gte('max_guests', guests) // the listing fits at least that many
  query = sort
    ? query.order('price_per_night', { ascending: sort === 'price_asc' })
    : query.order('created_at', { ascending: false }) // default: newest first

  const { data, error } = await query
  if (error) throw error
  return c.json<Listing[]>(data, 200)
})

listings.get('/:id', async (c) => {
  const id = idSchema.safeParse(c.req.param('id'))
  if (!id.success) return notFound(c)

  const { data, error } = await c.get('supabase').from('listings').select('*').eq('id', id.data).maybeSingle()
  if (error) throw error
  if (!data) return notFound(c)
  return c.json<Listing>(data, 200)
})

// G6: requireUser is the API's guard. The DB's own guard is that anon has no insert grant.
listings.post('/', requireUser, async (c) => {
  const parsed = createSchema.safeParse(await readBody(c.req))
  if (!parsed.success) return invalid(c, parsed.error)

  const { data, error } = await c.get('supabase').from('listings').insert(parsed.data).select().single()
  if (error) return writeError(c, error)
  return c.json<Listing>(data, 201)
})

// VG1: the update policy only matches the owner's rows. The API just explains why nothing changed.
listings.patch('/:id', requireUser, async (c) => {
  const id = idSchema.safeParse(c.req.param('id'))
  if (!id.success) return notFound(c)
  const parsed = updateSchema.safeParse(await readBody(c.req))
  if (!parsed.success) return invalid(c, parsed.error)

  const { data, error } = await c.get('supabase')
    .from('listings')
    .update(parsed.data)
    .eq('id', id.data)
    .select()
    .maybeSingle()
  if (error) return writeError(c, error)
  if (!data) return notOwnedOrMissing(c, c.get('supabase'), id.data)
  return c.json<Listing>(data, 200)
})

listings.delete('/:id', requireUser, async (c) => {
  const id = idSchema.safeParse(c.req.param('id'))
  if (!id.success) return notFound(c)

  // .select() returns the deleted rows, so we can see whether RLS let anything through
  const { data, error } = await c.get('supabase').from('listings').delete().eq('id', id.data).select('id')
  if (error) {
    // The cascade tries to delete the listing's bookings, and bookings_time refuses for a started one
    if (error.code === '23514') {
      return c.json({ error: 'This listing has a booking that has already started, so it can\'t be deleted' }, 409)
    }
    throw error
  }
  if (data.length === 0) return notOwnedOrMissing(c, c.get('supabase'), id.data)
  return c.body(null, 204)
})
