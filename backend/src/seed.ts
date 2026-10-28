// Fills the database with test users, listings and bookings. Run it once: npm run seed
//
// It talks to Supabase exactly like the app will: publishable key + a logged-in user.
// So every insert has to pass RLS and the booking triggers. No service-role key.
import 'dotenv/config'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database, TablesInsert } from './types/database.types.js'

type Client = SupabaseClient<Database>

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

// One client per user, so each one has its own session (and its own auth.uid() in the database)
async function logInAs(email: string): Promise<Client> {
  const client = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const { error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (signInError) {
    // First run: the user doesn't exist yet. "Confirm email" is off, so sign-up logs them in directly.
    const { data, error } = await client.auth.signUp({ email, password: PASSWORD })
    if (error) throw error
    if (!data.session) throw new Error(`${email} got no session after sign-up. Is "Confirm email" on?`)
  }

  return client
}

async function createListings(owner: Client, listings: TablesInsert<'listings'>[]) {
  const { data, error } = await owner.from('listings').insert(listings).select()
  if (error) throw error
  return data
}

async function createBooking(guest: Client, booking: Omit<TablesInsert<'bookings'>, 'total_price'>) {
  const { data, error } = await guest
    .from('bookings')
    // The generated type requires total_price, but the bookings_price trigger overwrites it (VG6)
    .insert({ ...booking, total_price: 0 })
    .select()
    .single()
  if (error) throw error
  return data
}

// 'YYYY-MM-DD', n days from today
function daysFromToday(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

const anna = await logInAs('anna@stayfinder.test')
const erik = await logInAs('erik@stayfinder.test')
const sara = await logInAs('sara@stayfinder.test')

const { count, error: countError } = await anna.from('listings').select('*', { count: 'exact', head: true })
if (countError) throw countError
if (count) {
  console.log(`There are already ${count} listings, so nothing was seeded. Users are logged in and ready.`)
  process.exit(0)
}

const [areCabin, sodermalmFlat] = await createListings(anna, [
  { title: 'Cabin by the slopes', location: 'Åre', price_per_night: 1200, max_guests: 6, description: 'Ski-in/ski-out cabin with a sauna.' },
  { title: 'Bright flat in Södermalm', location: 'Stockholm', price_per_night: 950, max_guests: 2, description: 'Top floor, close to the metro.' },
  { title: 'Studio near Central Station', location: 'Stockholm', price_per_night: 650, max_guests: 1, description: null }
])

const [seasideHouse, hagaApartment] = await createListings(erik, [
  { title: 'Seaside house', location: 'Visby', price_per_night: 1800, max_guests: 8, description: 'Big garden, five minutes from the beach.' },
  { title: 'Apartment in Haga', location: 'Göteborg', price_per_night: 800, max_guests: 3, description: 'Cosy apartment in the old town.' },
  { title: 'Townhouse in Malmö', location: 'Malmö', price_per_night: 1100, max_guests: 4, description: null }
])

await createBooking(sara, { listing_id: areCabin.id, email: 'sara@stayfinder.test', guests: 3, check_in: daysFromToday(14), check_out: daysFromToday(18) })
await createBooking(sara, { listing_id: seasideHouse.id, email: 'sara@stayfinder.test', guests: 5, check_in: daysFromToday(30), check_out: daysFromToday(35) })
await createBooking(erik, { listing_id: sodermalmFlat.id, email: 'erik@stayfinder.test', guests: 2, check_in: daysFromToday(7), check_out: daysFromToday(10) })
await createBooking(anna, { listing_id: hagaApartment.id, email: 'anna@stayfinder.test', guests: 2, check_in: daysFromToday(21), check_out: daysFromToday(23) })

// A cancelled booking, and an active one on overlapping dates: allowed, since cancelled bookings don't count (VG2)
const cancelled = await createBooking(sara, { listing_id: sodermalmFlat.id, email: 'sara@stayfinder.test', guests: 1, check_in: daysFromToday(40), check_out: daysFromToday(44) })
const { error: cancelError } = await sara.from('bookings').update({ status: 'cancelled' }).eq('id', cancelled.id)
if (cancelError) throw cancelError
await createBooking(erik, { listing_id: sodermalmFlat.id, email: 'erik@stayfinder.test', guests: 2, check_in: daysFromToday(42), check_out: daysFromToday(45) })

console.log('Seeded 3 users, 6 listings and 6 bookings (1 cancelled).')
console.log(`Log in as anna/erik/sara@stayfinder.test with password "${PASSWORD}".`)
