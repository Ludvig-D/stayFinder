// Step 2 of 3 of seeding: users, listings and bookings. Run with: npm run seed
// Before: supabase/seed/reset.sql (empty database). After: supabase/seed/past_booking.sql (VG5 data).
//
// It talks to Supabase exactly like the app does: publishable key + a logged-in user.
// So every insert has to pass RLS and the booking triggers. No service-role key.
//
// Some of this data is used by backend/tests/api.http (marked "api.http" below), so change it with care.
import 'dotenv/config'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables, TablesInsert } from './types/database.types.js'

type Client = SupabaseClient<Database>
type NewListing = Omit<TablesInsert<'listings'>, 'owner_id'> // owner_id defaults to auth.uid() in the DB
type NewBooking = Omit<TablesInsert<'bookings'>, 'guest_id' | 'total_price'>

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} must be set in backend/.env`)
  }
  return value
}

const SUPABASE_URL = requireEnv('SUPABASE_URL')
const SUPABASE_PUBLISHABLE_KEY = requireEnv('SUPABASE_PUBLISHABLE_KEY')
const PASSWORD = 'password123' // test accounts only

// Creates the user and returns a client logged in as them.
// One client per user, so each has its own session (and its own auth.uid() in the database).
async function createUser(email: string): Promise<Client> {
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  // "Confirm email" is off, so sign-up logs the user in directly.
  const { data, error } = await client.auth.signUp({ email, password: PASSWORD })
  if (error) {
    // Most likely the user already exists. Stop rather than add to old data,
    // so we never end up with a half-seeded database.
    throw new Error(`Could not create ${email}: ${error.message}. The seed expects an empty database: run supabase/seed/reset.sql first.`)
  }
  if (!data.session) {
    throw new Error(`${email} got no session after sign-up. Is "Confirm email" on?`)
  }

  return client
}

async function createListings(owner: Client, listings: NewListing[]): Promise<Tables<'listings'>[]> {
  const { data, error } = await owner.from('listings').insert(listings).select()
  if (error) throw error
  return data
}

async function createBooking(guest: Client, booking: NewBooking): Promise<Tables<'bookings'>> {
  const { data, error } = await guest
    .from('bookings')
    // The generated type requires total_price, but the bookings_price trigger overwrites it (VG6)
    .insert({ ...booking, total_price: 0 })
    .select()
    .single()
  if (error) throw error
  return data
}

// 'YYYY-MM-DD', n days from today in Swedish time (the same "today" as the bookings_time trigger)
function daysFromToday(days: number): string {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Stockholm' }) // 'YYYY-MM-DD'
  const date = new Date(`${today}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// ---------- Users ----------
// anna, erik and omar host; sara and lisa are guests. Hosts can also book other people's listings.
// anna goes first: if the database isn't empty, her sign-up fails and nothing has been changed.
const anna = await createUser('anna@stayfinder.test')
const erik = await createUser('erik@stayfinder.test')
const omar = await createUser('omar@stayfinder.test')
const sara = await createUser('sara@stayfinder.test')
const lisa = await createUser('lisa@stayfinder.test')

// ---------- Listings ----------
// api.http needs exactly 2 listings whose location contains "stock" (650 and 950),
// and exactly one each in Åre, Visby, Göteborg and Malmö. No other location may contain those names.
const [areCabin, sodermalmFlat, , rattvikCabin] = await createListings(anna, [
  { title: 'Cabin by the slopes', location: 'Åre', price_per_night: 1200, max_guests: 6, description: 'Ski-in/ski-out cabin with a sauna.' },
  { title: 'Bright flat in Södermalm', location: 'Stockholm', price_per_night: 950, max_guests: 2, description: 'Top floor, close to the metro.' },
  { title: 'Studio near Central Station', location: 'Stockholm', price_per_night: 650, max_guests: 1, description: null },
  { title: 'Lakeside cabin', location: 'Rättvik', price_per_night: 980, max_guests: 4, description: 'Red cabin with its own jetty on Lake Siljan.' }
])

// api.http: "Townhouse in Malmö" (1100, max 4) must have no bookings.
const [seasideHouse, hagaApartment] = await createListings(erik, [
  { title: 'Seaside house', location: 'Visby', price_per_night: 1800, max_guests: 8, description: 'Big garden, five minutes from the beach.' },
  { title: 'Apartment in Haga', location: 'Göteborg', price_per_night: 800, max_guests: 3, description: 'Cosy apartment in the old town.' },
  { title: 'Townhouse in Malmö', location: 'Malmö', price_per_night: 1100, max_guests: 4, description: null },
  { title: 'Loft in the old town', location: 'Lund', price_per_night: 700, max_guests: 2, description: 'Quiet loft, a short walk from the university.' }
])

const [kirunaCabin, vaxholmVilla, uppsalaRoom] = await createListings(omar, [
  { title: 'Glass cabin under the northern lights', location: 'Kiruna', price_per_night: 3200, max_guests: 2, description: 'Glass roof over the bed. Best from September to March.' },
  { title: 'Archipelago villa', location: 'Vaxholm', price_per_night: 2600, max_guests: 10, description: 'Large villa with a boat jetty, 1 hour by boat from the city.' },
  { title: 'Student room by the cathedral', location: 'Uppsala', price_per_night: 450, max_guests: 1, description: 'Simple room with a shared kitchen.' },
  { title: 'Cottage by the lighthouse', location: 'Öland', price_per_night: 1350, max_guests: 5, description: null }
])

// ---------- Bookings ----------
// Dates are relative to today, so the seed works whenever it's run.

// sara books several listings (what a guest sees)
await createBooking(sara, { listing_id: areCabin.id, email: 'sara@stayfinder.test', guests: 3, check_in: daysFromToday(14), check_out: daysFromToday(18) })
// api.http: sara's only future booking on Seaside house (her past one comes from past_booking.sql)
await createBooking(sara, { listing_id: seasideHouse.id, email: 'sara@stayfinder.test', guests: 5, check_in: daysFromToday(30), check_out: daysFromToday(35) })
await createBooking(sara, { listing_id: kirunaCabin.id, email: 'sara@stayfinder.test', guests: 2, check_in: daysFromToday(50), check_out: daysFromToday(53) })

// Back to back with sara on Seaside house: lisa checks in the day sara checks out (VG2, '[)').
// Together with omar below, erik as owner sees bookings from three guests on one listing (VG1).
await createBooking(lisa, { listing_id: seasideHouse.id, email: 'lisa@stayfinder.test', guests: 4, check_in: daysFromToday(35), check_out: daysFromToday(38) })
await createBooking(omar, { listing_id: seasideHouse.id, email: 'omar@stayfinder.test', guests: 6, check_in: daysFromToday(45), check_out: daysFromToday(48) })

// A cancelled booking, and an active one on overlapping dates: allowed, since cancelled bookings don't count (VG2)
const cancelled = await createBooking(lisa, { listing_id: sodermalmFlat.id, email: 'lisa@stayfinder.test', guests: 1, check_in: daysFromToday(40), check_out: daysFromToday(44) })
const { error: cancelError } = await lisa.from('bookings').update({ status: 'cancelled' }).eq('id', cancelled.id)
if (cancelError) throw cancelError
await createBooking(erik, { listing_id: sodermalmFlat.id, email: 'erik@stayfinder.test', guests: 2, check_in: daysFromToday(42), check_out: daysFromToday(45) })

// Hosts booking each other's listings
await createBooking(anna, { listing_id: hagaApartment.id, email: 'anna@stayfinder.test', guests: 2, check_in: daysFromToday(21), check_out: daysFromToday(23) })
await createBooking(erik, { listing_id: vaxholmVilla.id, email: 'erik@stayfinder.test', guests: 8, check_in: daysFromToday(60), check_out: daysFromToday(62) })
await createBooking(lisa, { listing_id: uppsalaRoom.id, email: 'lisa@stayfinder.test', guests: 1, check_in: daysFromToday(10), check_out: daysFromToday(15) })
await createBooking(omar, { listing_id: rattvikCabin.id, email: 'omar@stayfinder.test', guests: 4, check_in: daysFromToday(25), check_out: daysFromToday(28) })

console.log('Seeded 5 users, 12 listings and 11 bookings (1 cancelled).')
console.log(`Log in as anna/erik/omar/sara/lisa@stayfinder.test with password "${PASSWORD}".`)
console.log('Next: run supabase/seed/past_booking.sql in the SQL editor (the started booking for VG5).')
