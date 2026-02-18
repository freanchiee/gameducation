'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, BookOpenCheck, LogOut, Sparkles, ClipboardList } from 'lucide-react'

const NAV_ITEMS = [
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
      <aside className="hidden md:flex md:w-72 md:flex-col md:h-screen md:sticky md:top-0 border-r border-slate-200/70 bg-white/90 backdrop-blur">
        <div className="px-6 pt-7 pb-5 border-b border-slate-200/70">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 text-white flex items-center justify-center shadow-sm">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight text-slate-900">VoiceIQ</p>
              <p className="text-xs text-slate-500">Teacher Workspace</p>
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
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
                ].join(' ')}
              >
                <Icon size={16} className={active ? 'text-white' : 'text-slate-400 group-hover:text-slate-700'} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-slate-200/70">
          <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 mb-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">Signed in as</p>
            <p className="text-sm text-slate-700 truncate">{email}</p>
          </div>
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="md:hidden sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between mb-3">
            <p className="text-lg font-semibold tracking-tight text-slate-900">VoiceIQ</p>
            <form action="/api/auth/signout" method="POST">
              <button type="submit" className="text-sm text-slate-600">
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
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600',
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
