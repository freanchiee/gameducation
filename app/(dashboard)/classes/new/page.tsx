'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft } from 'lucide-react'

const YEAR_GROUPS = {
  MYP: ['MYP 1', 'MYP 2', 'MYP 3', 'MYP 4', 'MYP 5'],
  DP: ['DP Year 1', 'DP Year 2'],
} as const

const SUBJECTS = [
  'Physics', 'Chemistry', 'Biology',
  'Mathematics', 'English', 'History', 'Geography',
]

export default function NewClassPage() {
  const router = useRouter()
  const supabase = createClient()

  const [programme, setProgramme] = useState<'MYP' | 'DP'>('MYP')
  const [form, setForm] = useState({
    name: '',
    year_group: 'MYP 4',
    subject: 'Physics',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleProgramme(p: 'MYP' | 'DP') {
    setProgramme(p)
    setForm(f => ({ ...f, year_group: YEAR_GROUPS[p][p === 'MYP' ? 3 : 0] ?? '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error: insertError } = await supabase.from('classes').insert({
      ...form,
      programme,
      teacher_id: user.id,
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
    } else {
      router.push('/classes')
      router.refresh()
    }
  }

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/classes" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Class</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Set up a class for oral assessments</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        {/* Class name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Class name
          </label>
          <input
            required
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. 10A Physics"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Programme toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Programme
          </label>
          <div className="flex gap-3">
            {(['MYP', 'DP'] as const).map(p => (
              <button
                key={p}
                type="button"
                onClick={() => handleProgramme(p)}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                  programme === p
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-300'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Year group */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Year group
          </label>
          <select
            value={form.year_group}
            onChange={e => setForm(f => ({ ...f, year_group: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {YEAR_GROUPS[programme].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* Subject */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Subject
          </label>
          <select
            value={form.subject}
            onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SUBJECTS.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Link
            href="/classes"
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Creating…' : 'Create class'}
          </button>
        </div>
      </form>
    </div>
  )
}
