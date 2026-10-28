import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { createMiddleware } from 'hono/factory'
import { setCookie } from 'hono/cookie'
import type { Context } from 'hono'
import type { Database } from '../types/database.types.js'
import type { AppEnv, Supabase } from '../types/hono.js'
import { env } from './env.js'

// One client per request, so every query runs as the user whose cookies came with that request.
// Publishable key, never the service-role key: RLS must see the real user (G15, VG1).
function createSupabase(c: Context): Supabase {
  return createServerClient<Database>(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
    // httpOnly: the frontend never talks to Supabase itself, so no JS needs to read the token (protects it from XSS)
    cookieOptions: { httpOnly: true, sameSite: 'lax', path: '/' },
    cookies: {
      // The session cookies the browser sent
      getAll() {
        return parseCookieHeader(c.req.header('Cookie') ?? '').map(({ name, value }) => ({
          name,
          value: value ?? ''
        }))
      },
      // Supabase wants to write cookies (login, token refresh, logout): put them on the response
      setAll(cookiesToSet, headers) {
        for (const { name, value, options } of cookiesToSet) {
          setCookie(c, name, value, {
            path: options.path,
            domain: options.domain,
            maxAge: options.maxAge,
            httpOnly: options.httpOnly,
            secure: options.secure,
            sameSite: 'Lax'
          })
        }
        // No-cache headers, so a proxy never serves one user's session cookie to someone else
        for (const [key, value] of Object.entries(headers)) {
          c.header(key, value)
        }
      }
    }
  })
}

// Runs before every route and puts the client on the context: c.get('supabase')
export const supabaseMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.set('supabase', createSupabase(c))
  await next()
})
