'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BarChart3, BookOpenCheck, LogOut, Sparkles, ClipboardList, LayoutDashboard, PanelLeftClose, PanelLeftOpen } from 'lucide-react'

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
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    const saved = sessionStorage.getItem('voiceiq.sidebar.collapsed')
    if (saved === '1') setCollapsed(true)
  }, [])

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev
      sessionStorage.setItem('voiceiq.sidebar.collapsed', next ? '1' : '0')
      return next
    })
  }

  return (
    <>
      <aside className={`hidden md:flex md:flex-col md:h-screen md:sticky md:top-0 gd-panel transition-all duration-200 ${collapsed ? 'md:w-20' : 'md:w-72'}`}>
        <div className={`pt-5 pb-4 border-b border-[#b6c9cf] ${collapsed ? 'px-3' : 'px-6'}`}>
          <div className={`relative flex items-center ${collapsed ? 'justify-center' : 'justify-between'} gap-3`}>
            <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#24408f] text-[#f6f1d0] flex items-center justify-center shadow-sm">
              <Sparkles size={18} />
            </div>
              {!collapsed && (
                <div>
                  <p className="text-lg font-semibold tracking-tight text-[#223a83]">VoiceIQ</p>
                  <p className="text-xs text-[#50627a]">Teacher Workspace</p>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                type="button"
                onClick={toggleCollapsed}
                className="rounded-lg p-1.5 text-[#4f6290] hover:bg-[#dbe8ec] transition-colors"
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose size={16} />
              </button>
            )}
            {collapsed && (
              <button
                type="button"
                onClick={toggleCollapsed}
                className="absolute top-3 right-2 rounded-lg p-1.5 text-[#4f6290] hover:bg-[#dbe8ec] transition-colors"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen size={16} />
              </button>
            )}
          </div>
        </div>

        <nav className="p-3 space-y-2">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href)
            const Icon = item.icon

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'group flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition-all',
                  collapsed ? 'justify-center' : 'gap-3',
                  active
                    ? 'bg-[#24408f] text-white shadow-sm'
                    : 'text-[#2b427f] hover:bg-[#dbe8ec] hover:text-[#1e367b]',
                ].join(' ')}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={16} className={active ? 'text-white' : 'text-[#5f7397] group-hover:text-[#1e367b]'} />
                {!collapsed && item.label}
              </Link>
            )
          })}
        </nav>

        <div className={`mt-auto border-t border-[#b6c9cf] ${collapsed ? 'p-2' : 'p-4'}`}>
          {!collapsed && (
            <div className="rounded-xl border border-[#bfd0d7] bg-[#f0fafc] px-3 py-2.5 mb-3">
              <p className="text-[11px] uppercase tracking-wider text-[#6b7b8f] mb-1">Signed in as</p>
              <p className="text-sm text-[#2b427f] truncate">{email}</p>
            </div>
          )}
          <form action="/api/auth/signout" method="POST">
            <button
              type="submit"
              className={`w-full flex items-center justify-center rounded-xl border border-[#bacbd1] bg-[#f0fafc] py-2.5 text-sm font-medium text-[#2b427f] hover:text-[#1a326f] hover:border-[#9fb4bf] transition-colors ${collapsed ? '' : 'gap-2'}`}
              title={collapsed ? 'Sign out' : undefined}
            >
              <LogOut size={14} />
              {!collapsed && 'Sign out'}
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
