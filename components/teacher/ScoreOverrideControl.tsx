'use client'

import { useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  evaluationId: string
  aiLevel: number | null
  initialOverride: number | null
}

const BANDS = [
  { min: 0, max: 0, label: 'Not Assessed' },
  { min: 1, max: 2, label: 'Limited' },
  { min: 3, max: 4, label: 'Adequate' },
  { min: 5, max: 6, label: 'Substantial' },
  { min: 7, max: 8, label: 'Excellent' },
]

function bandFor(level: number | null) {
  const safe = level ?? 0
  return BANDS.find((b) => safe >= b.min && safe <= b.max)?.label ?? 'Not Assessed'
}

export default function ScoreOverrideControl({ evaluationId, aiLevel, initialOverride }: Props) {
  const supabase = createClient()
  const [value, setValue] = useState<string>(initialOverride === null ? '' : String(initialOverride))
  const [savedOverride, setSavedOverride] = useState<number | null>(initialOverride)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const effectiveLevel = useMemo(
    () => (savedOverride ?? aiLevel ?? 0),
    [savedOverride, aiLevel]
  )

  async function save() {
    setSaving(true)
    setError(null)
    setMessage(null)
    const nextOverride = value === '' ? null : Number(value)

    if (nextOverride !== null && (Number.isNaN(nextOverride) || nextOverride < 0 || nextOverride > 8)) {
      setError('Override must be between 0 and 8.')
      setSaving(false)
      return
    }

    const { error: updateError } = await supabase
      .from('evaluations')
      .update({
        teacher_override_level: nextOverride,
        reviewed_by_teacher: true,
      })
      .eq('id', evaluationId)

    if (updateError) {
      setError(updateError.message)
      setSaving(false)
      return
    }

    setSavedOverride(nextOverride)
    setMessage(nextOverride === null ? 'Override cleared.' : 'Override saved.')
    setSaving(false)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Teacher Override (Criterion A)
      </h2>
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="text-sm text-gray-600 mb-2">
            AI score: <span className="font-semibold text-gray-900">{aiLevel ?? '—'}/8</span> ({bandFor(aiLevel)})
          </p>
          <label className="block text-sm font-medium text-gray-700 mb-1">Override level</label>
          <select
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-800 bg-white"
          >
            <option value="">No override (use AI score)</option>
            {Array.from({ length: 9 }, (_, i) => (
              <option key={i} value={i}>
                {i}/8 ({bandFor(i)})
              </option>
            ))}
          </select>
          <p className="mt-2 text-sm text-gray-700">
            Effective score: <span className="font-semibold text-gray-900">{effectiveLevel}/8</span> ({bandFor(effectiveLevel)})
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Saving...' : 'Save override'}
        </button>
      </div>
      {message && <p className="mt-3 text-sm text-green-600">{message}</p>}
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  )
}
