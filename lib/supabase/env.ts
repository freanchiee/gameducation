const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function isHttpUrl(value: string) {
  return value.startsWith('http://') || value.startsWith('https://')
}

function isSupabaseApiUrl(value: string) {
  try {
    const { hostname } = new URL(value)
    return hostname.endsWith('.supabase.co')
  } catch {
    return false
  }
}

export function hasSupabaseEnv() {
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      isHttpUrl(supabaseUrl) &&
      isSupabaseApiUrl(supabaseUrl)
  )
}

export function getSupabaseEnv() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  if (!isHttpUrl(supabaseUrl)) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL must be a valid http(s) URL. Check your .env.local values.'
    )
  }

  if (!isSupabaseApiUrl(supabaseUrl)) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL must be your Supabase API URL (https://<project-ref>.supabase.co), not a dashboard URL.'
    )
  }

  return { supabaseUrl, supabaseAnonKey }
}
