import type { createServerClient } from '@supabase/ssr'
import type { User } from '@supabase/supabase-js'
import type { Database } from './database.types.js'

// The client type, taken from createServerClient itself. Writing SupabaseClient<Database> from
// supabase-js doesn't work: @supabase/ssr loads the CommonJS copy of those types and our code the
// ESM copy, and TypeScript treats the two SupabaseClient classes as unrelated.
export type Supabase = ReturnType<typeof createServerClient<Database>>

// What c.get() returns on every route: the per-request Supabase client
export type AppEnv = {
  Variables: {
    supabase: Supabase
  }
}

// Routes behind requireUser also know who is logged in
export type AuthedEnv = {
  Variables: AppEnv['Variables'] & {
    user: User
  }
}
