import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link href="/classes" className="text-xl font-bold text-blue-600">
                VoiceIQ
              </Link>
              <div className="flex gap-6 text-sm font-medium">
                <Link
                  href="/classes"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Classes
                </Link>
                <Link
                  href="/assessments"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Assessments
                </Link>
                <Link
                  href="/reports"
                  className="text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Reports
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">{user.email}</span>
              <form action="/api/auth/signout" method="POST">
                <button
                  type="submit"
                  className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
                >
                  Sign out
                </button>
              </form>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  )
}
