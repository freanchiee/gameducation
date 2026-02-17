import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabaseEnv } from '@/lib/supabase/env'

type CookieToSet = { name: string; value: string; options?: any }

/**
 * Supabase server client for use in Server Components, API routes, and Server Actions.
 * Reads cookies from the Next.js request context for session management.
 */
export async function createClient() {
  const cookieStore = await cookies()
  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method is called from a Server Component.
            // This is expected and can be ignored when middleware refreshes sessions.
          }
        },
      },
    }
  )
}
