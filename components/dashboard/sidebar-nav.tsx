'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, BookOpenCheck, LogOut, Sparkles, ClipboardList, LayoutDashboard } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/classes', label: 'Classes', icon: BookOpenCheck },
  { href: '/assessments', label: 'Assessments', icon: ClipboardList },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
]

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function SidebarNav({ email }: { email: string }) {
  const pathname = usePathname()

  return (
    <>
      <aside className="hidden md:flex md:w-72 md:flex-col md:h-screen md:sticky md:top-0 gd-panel">
        <div className="px-6 pt-7 pb-5 border-b border-[#b6c9cf]">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#24408f] text-[#f6f1d0] flex items-center justify-center shadow-sm">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight text-[#223a83]">VoiceIQ</p>
              <p className="text-xs text-[#50627a]">Teacher Workspace</p>
            </div>
          </div>
        </div>

        <nav className="p-4 space-y-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                  active
                    ? 'bg-[#24408f] text-white shadow-sm'
                    : 'text-[#2b427f] hover:bg-[#dbe8ec] hover:text-[#1e367b]',
                ].join(' ')}
              >
                <Icon size={16} className={active ? 'text-white' : 'text-[#5f7397] group-hover:text-[#1e367b]'} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-[#b6c9cf]">
          <div className="rounded-xl border border-[#bfd0d7] bg-[#f0fafc] px-3 py-2.5 mb-3">
            <p className="text-[11px] uppercase tracking-wider text-[#6b7b8f] mb-1">Signed in as</p>
            <p className="text-sm text-[#2b427f] truncate">{email}</p>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#bacbd1] bg-[#f0fafc] py-2.5 text-sm font-medium text-[#2b427f] hover:text-[#1a326f] hover:border-[#9fb4bf] transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="md:hidden sticky top-0 z-30 border-b border-[#b8c9cf] bg-[#d5e4e7]/95 backdrop-blur">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-lg font-semibold tracking-tight text-[#223a83]">VoiceIQ</p>
            <form action="/api/auth/signout" method="POST">
              <button type="submit" className="text-sm text-[#2b427f]">
                Sign out
              </button>
            </form>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={[
                    'shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                    active
                      ? 'bg-[#24408f] text-white'
                      : 'bg-[#e6efef] text-[#2b427f]',
                  ].join(' ')}
                >
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
