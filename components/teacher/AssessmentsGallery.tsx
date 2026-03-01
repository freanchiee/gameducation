'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Clock3, CheckCircle2, PlusCircle, Search, PlayCircle } from 'lucide-react'
import { createWallpaper, createCardAccent } from '@/lib/ui/wallpaper'

type AssessmentRow = {
  id: string
  title: string
  topic: string
  max_questions: number
  status: 'draft' | 'active' | 'closed'
  access_code: string
  assessment_mode?: 'voice' | 'multimodal'
  classes?: { name?: string | null; year_group?: string | null; programme?: string | null } | null
}

type DraftRow = {
  id: string
  title: string | null
  topic: string | null
  mode: 'voice' | 'multimodal'
  updated_at: string
}

type Props = {
  assessments: AssessmentRow[]
  drafts: DraftRow[]
}

const STATUS_ICON = {
  draft: Clock3,
  active: PlayCircle,
  closed: CheckCircle2,
} as const

export default function AssessmentsGallery({ assessments, drafts }: Props) {
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState<'all' | 'draft' | 'active' | 'closed'>('all')

  const featured = assessments.slice(0, 2)
  const wallpaper = useMemo(() => createWallpaper(`assessments:${assessments[0]?.id ?? 'empty'}`), [assessments])

  const filtered = useMemo(() => {
    return assessments.filter((a) => {
      const q = query.trim().toLowerCase()
      const matchesQuery =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.topic.toLowerCase().includes(q) ||
        (a.classes?.name ?? '').toLowerCase().includes(q)
      const matchesTab = tab === 'all' ? true : a.status === tab
      return matchesQuery && matchesTab
    })
  }, [assessments, query, tab])

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <section className="relative overflow-hidden rounded-3xl p-6 md:p-8 text-white shadow-xl" style={{ background: wallpaper.gradient }}>
        {wallpaper.blobs.map((b, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white blur-2xl"
            style={{
              width: b.size,
              height: b.size,
              top: `${b.top}%`,
              left: `${b.left}%`,
              opacity: b.opacity,
              animation: `gd-drift ${b.duration}s ease-in-out ${b.delay}s infinite`,
            }}
          />
        ))}

        <div className="relative z-10 grid md:grid-cols-[1.2fr_1fr] gap-6 items-stretch">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.2em] text-white/80">VoiceIQ Workspace</p>
            <h1 className="text-3xl md:text-4xl font-semibold">Assessment Studio</h1>
            <p className="max-w-xl text-white/90 text-sm md:text-base">
              Manage active, closed, and draft assessments. Continue draft forms from server state and launch new sessions quickly.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/assessments/new" className="inline-flex items-center gap-2 rounded-xl bg-white/20 hover:bg-white/30 px-4 py-2 text-sm font-medium transition-colors">
                <PlusCircle size={16} /> New Assessment
              </Link>
              <button
                type="button"
                onClick={() => setTab('draft')}
                className="rounded-xl bg-white/10 hover:bg-white/20 px-4 py-2 text-sm font-medium transition-colors"
              >
                View Drafts
              </button>
            </div>
          </div>

          {/* Featured cards */}
          <div className="grid grid-cols-1 gap-3">
            {featured.map((item) => {
              const accent = createCardAccent(item.id)
              const Icon = STATUS_ICON[item.status]
              return (
                <Link
                  key={item.id}
                  href={`/assessments/${item.id}`}
                  className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/90 text-[#1f2f63] p-4 shadow-lg"
                  style={{ animation: `gd-float ${accent.duration}s ease-in-out ${accent.delay}s infinite` }}
                >
                  <div className="absolute inset-0" style={{ background: accent.gradient }} />
                  <div className="relative space-y-2">
                    <p className="text-xs text-[#495b8f] flex items-center gap-1"><Icon size={14} /> {item.status}</p>
                    <p className="font-semibold leading-tight">{item.title}</p>
                    <p className="text-xs text-[#5a6788]">{item.topic} · {item.assessment_mode === 'multimodal' ? 'Multimodal' : 'Voice'}</p>
                  </div>
                </Link>
              )
            })}
            {featured.length === 0 && (
              <div className="rounded-2xl border border-white/20 bg-white/10 p-4 text-white/60 text-sm">
                No assessments yet. Create one to get started.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Filter + search + list */}
      <section className="gd-surface p-4 md:p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap gap-2">
            {(['all', 'draft', 'active', 'closed'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setTab(item)}
                className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                  tab === item ? 'bg-[#24408f] text-white' : 'bg-white text-[#324578] border border-[#d2d8ea]'
                }`}
              >
                {item[0].toUpperCase() + item.slice(1)}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71809f]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search assessments"
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#ccd5e6] bg-white text-sm"
            />
          </div>
        </div>

        {filtered.length > 0 ? (
          <div className="space-y-3">
            {filtered.map((a) => {
              const Icon = STATUS_ICON[a.status]
              return (
                <Link
                  key={a.id}
                  href={`/assessments/${a.id}`}
                  className="group relative overflow-hidden block rounded-2xl border border-[#d4dced] bg-white px-5 py-4 hover:shadow-md transition-all"
                >
                  <div
                    className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ background: createCardAccent(a.id).gradient }}
                  />
                  <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-[#223a83]">{a.title}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#ecf0fb] text-[#394d82] inline-flex items-center gap-1">
                          <Icon size={12} /> {a.status}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-[#ece6bf] text-[#3d4f7f]">
                          {a.assessment_mode === 'multimodal' ? 'Multimodal' : 'Voice'}
                        </span>
                      </div>
                      <p className="text-sm text-[#516079]">{a.classes?.name} · {a.topic} · {a.max_questions} questions</p>
                    </div>
                    {a.status === 'active' && (
                      <div className="text-xs bg-[#f6f2d3] border border-[#d7ca8e] rounded-lg px-3 py-2 font-mono text-[#284189]">
                        Code: <span className="font-semibold tracking-widest text-base">{a.access_code}</span>
                      </div>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#c8d2e3] p-8 text-center text-sm text-[#62708f]">
            {assessments.length === 0
              ? 'No assessments yet. Create your first one above.'
              : 'No assessments match your filters.'}
          </div>
        )}
      </section>

      {/* Server draft forms */}
      {drafts.length > 0 && (
        <section className="gd-surface p-4 md:p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-[#223a83]">Server Draft Forms</h2>
            <span className="text-xs text-[#62708f]">{drafts.length} saved</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {drafts.map((d) => {
              const accent = createCardAccent(`draft:${d.id}`)
              return (
                <Link
                  key={d.id}
                  href={`/assessments/new?draft=${d.id}`}
                  className="relative overflow-hidden rounded-xl border border-[#d5deef] bg-white px-4 py-3 hover:shadow-md transition-all"
                  style={{ animation: `gd-float ${accent.duration}s ease-in-out ${accent.delay}s infinite` }}
                >
                  <div className="absolute inset-0 opacity-60" style={{ background: accent.gradient }} />
                  <div className="relative">
                    <p className="font-medium text-[#223a83]">{d.title || d.topic || 'Untitled draft'}</p>
                    <p className="text-xs text-[#586688] mt-1">{d.mode === 'multimodal' ? 'Multimodal' : 'Voice'} · Updated {new Date(d.updated_at).toLocaleString()}</p>
                    <p className="text-xs text-[#2f4c92] mt-2">Open draft</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
