// Reads the env vars once at startup, so a missing one fails loudly instead of becoming `undefined` later
import 'dotenv/config'

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} must be set in backend/.env`)
  }
  return value
}

export const env = {
  SUPABASE_URL: requireEnv('SUPABASE_URL'),
  SUPABASE_PUBLISHABLE_KEY: requireEnv('SUPABASE_PUBLISHABLE_KEY'),
  FRONTEND_ORIGIN: requireEnv('FRONTEND_ORIGIN')
}
