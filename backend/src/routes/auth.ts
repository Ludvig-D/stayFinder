import { Hono } from 'hono'
import { z } from 'zod'
import type { User } from '@supabase/supabase-js'
import type { AppEnv } from '../types/hono.js'
import { requireUser } from '../middleware/requireUser.js'

// Same rules as Supabase Auth (min 6 is the project default), checked here first for a clear 400
const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(6)
})

type UserResponse = { id: string; email: string | undefined }

// Only send what the frontend needs, not the whole Supabase user object
function toUserResponse(user: User): UserResponse {
  return { id: user.id, email: user.email }
}

export const auth = new Hono<AppEnv>()

// Reads the JSON body and validates it. Returns null on bad/missing JSON so the route can answer 400.
async function readCredentials(req: { json(): Promise<unknown> }) {
  const body: unknown = await req.json().catch(() => null)
  return credentialsSchema.safeParse(body)
}

auth.post('/register', async (c) => {
  const parsed = await readCredentials(c.req)
  if (!parsed.success) {
    return c.json({ error: 'Invalid data', details: z.flattenError(parsed.error).fieldErrors }, 400)
  }

  const { data, error } = await c.get('supabase').auth.signUp(parsed.data)
  if (error) {
    if (error.code === 'user_already_exists') {
      return c.json({ error: 'Email is already registered' }, 409)
    }
    if (error.code === 'weak_password') {
      return c.json({ error: 'Password is too weak' }, 400)
    }
    throw error
  }
  if (!data.user) {
    throw new Error('Sign-up returned no user')
  }

  // "Confirm email" is off, so sign-up also logged the user in and the cookies are already set
  return c.json(toUserResponse(data.user), 201)
})

auth.post('/login', async (c) => {
  const parsed = await readCredentials(c.req)
  if (!parsed.success) {
    return c.json({ error: 'Invalid data', details: z.flattenError(parsed.error).fieldErrors }, 400)
  }

  const { data, error } = await c.get('supabase').auth.signInWithPassword(parsed.data)
  if (error) {
    if (error.code === 'invalid_credentials') {
      return c.json({ error: 'Wrong email or password' }, 401)
    }
    throw error
  }

  return c.json(toUserResponse(data.user), 200)
})

// Always 204: logging out when already logged out is harmless
auth.post('/logout', async (c) => {
  // scope 'local': log out this browser only, not the user's other devices
  const { error } = await c.get('supabase').auth.signOut({ scope: 'local' })
  if (error) throw error

  return c.body(null, 204)
})

auth.get('/me', requireUser, (c) => {
  return c.json(toUserResponse(c.get('user')), 200)
})
