import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { env } from './lib/env.js'
import { supabaseMiddleware } from './lib/supabase.js'
import { auth } from './routes/auth.js'
import { listings } from './routes/listings.js'
import { bookings } from './routes/bookings.js'
import type { AppEnv } from './types/hono.js'

const app = new Hono<AppEnv>()

// credentials: true lets the browser send the session cookies. That only works with one exact origin, not '*'.
app.use(cors({ origin: env.FRONTEND_ORIGIN, credentials: true }))
app.use(supabaseMiddleware)

app.route('/auth', auth)
app.route('/listings', listings)
app.route('/', bookings) // /listings/:id/bookings and /bookings/:id

// Anything unexpected (Supabase down, a bug): log it, but don't leak details to the client
app.onError((err, c) => {
  console.error(err)
  return c.json({ error: 'Something went wrong' }, 500)
})

serve({
  fetch: app.fetch,
  port: 3001
}, (info) => {
  console.log(`Server is running on http://localhost:${info.port}`)
})
