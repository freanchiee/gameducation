import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SidebarNav } from '@/components/dashboard/sidebar-nav'

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50/40 text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1680px]">
        <SidebarNav email={user.email ?? ''} />
        <main className="flex-1 min-w-0 px-4 py-6 sm:px-6 md:px-10 md:py-10">
          {children}
        </main>
      </div>
    </div>
  )
}
