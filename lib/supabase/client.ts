import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseEnv } from '@/lib/supabase/env'

/**
 * Supabase browser client for use in Client Components.
 * Uses the public anon key — RLS policies enforce data security.
 */
export function createClient() {
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()

  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  )
}
