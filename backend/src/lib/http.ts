import type { Context } from 'hono'
import { z } from 'zod'

// Helpers shared by the listings and bookings routes

// An id that isn't a uuid can't exist, so it's a 404. It also stops Postgres' 22P02 error from becoming a 500.
export const idSchema = z.uuid()

export function invalid(c: Context, error: z.ZodError) {
  return c.json({ error: 'Invalid data', details: z.flattenError(error).fieldErrors }, 400)
}

// Reads the JSON body. Bad/missing JSON becomes null, which the schema then rejects with a 400.
export async function readBody(req: { json(): Promise<unknown> }): Promise<unknown> {
  return req.json().catch(() => null)
}
