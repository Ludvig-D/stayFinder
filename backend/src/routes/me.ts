import { Hono } from 'hono'
import type { AuthedEnv } from '../types/hono.js'
import type { Tables } from '../types/database.types.js'
import { requireUser } from '../middleware/requireUser.js'

// The DB row types from the generated types (G16)
type Listing = Tables<'listings'>
// A booking with the few listing fields "My bookings" shows, so the page needs no extra call per row
type MyBooking = Tables<'bookings'> & { listing: Pick<Listing, 'id' | 'title' | 'location'> }

// Everything here is about the logged-in user, so requireUser runs on every route (401 otherwise).
// use('*') is safe here because this app is mounted at /me, so '*' only matches /me/...
// (bookings.ts can't do this: it's mounted at '/', where '*' would catch every path in the app).
export const me = new Hono<AuthedEnv>()
me.use('*', requireUser)

// "My listings". Listings are public, so this filter isn't security: it just picks the user's own.
me.get('/listings', async (c) => {
  const { data, error } = await c.get('supabase')
    .from('listings')
    .select('*')
    .eq('owner_id', c.get('user').id)
    .order('created_at', { ascending: false }) // newest first, same as the list on /
  if (error) throw error
  return c.json<Listing[]>(data, 200)
})

// "My bookings": the bookings the user made as a guest.
// RLS (the select policy) already limits what comes back to "my bookings + bookings on my listings" (VG1).
// The guest_id filter is not a security rule: it picks the first group, because that's what this page shows.
// RLS = what you're allowed to see, the query = what this page wants.
me.get('/bookings', async (c) => {
  const { data, error } = await c.get('supabase')
    .from('bookings')
    // listing:listings(...) joins the listing through the listing_id foreign key, and names it "listing".
    // It's a many-to-one join, so each booking gets one listing object, not a list.
    .select('*, listing:listings(id, title, location)')
    .eq('guest_id', c.get('user').id)
    .order('check_in', { ascending: true })
  if (error) throw error
  return c.json<MyBooking[]>(data, 200)
})
