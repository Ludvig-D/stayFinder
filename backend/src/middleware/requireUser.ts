import { createMiddleware } from 'hono/factory'
import type { AuthedEnv } from '../types/hono.js'

// 401 unless someone is logged in. Put it in front of any route that needs a user.
export const requireUser = createMiddleware<AuthedEnv>(async (c, next) => {
  // getUser() asks Supabase to verify the token. getSession() would only read the cookie, which anyone can fake.
  const { data, error } = await c.get('supabase').auth.getUser()
  if (error || !data.user) {
    return c.json({ error: 'Not logged in' }, 401)
  }

  c.set('user', data.user)
  await next()
})
