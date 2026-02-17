import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { getSupabaseEnv, hasSupabaseEnv } from '@/lib/supabase/env'

const TEACHER_ROUTES = ['/classes', '/assessments', '/reports']
const PUBLIC_ROUTES = ['/login', '/signup', '/reset-password']
// Student routes (/lobby, /session, /results) are semi-public (code-gated, no auth required)
type CookieToSet = { name: string; value: string; options?: any }

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  if (!hasSupabaseEnv()) {
    return supabaseResponse
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv()

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isTeacherRoute = TEACHER_ROUTES.some((r) => pathname.startsWith(r))
  const isPublicRoute = PUBLIC_ROUTES.some((r) => pathname.startsWith(r))

  if (isTeacherRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (isPublicRoute && user) {
    return NextResponse.redirect(new URL('/classes', request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
