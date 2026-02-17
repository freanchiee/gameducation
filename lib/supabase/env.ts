const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function isHttpUrl(value: string) {
  return value.startsWith('http://') || value.startsWith('https://')
}

export function hasSupabaseEnv() {
  return Boolean(
    supabaseUrl && supabaseAnonKey && isHttpUrl(supabaseUrl)
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

  return { supabaseUrl, supabaseAnonKey }
}
