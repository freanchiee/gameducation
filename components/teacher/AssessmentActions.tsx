'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AssessmentStatus } from '@/lib/types'
import { Copy, Check } from 'lucide-react'

interface Props {
  assessmentId: string
  currentStatus: AssessmentStatus
  accessCode: string
}

const STATUS_TRANSITIONS: Record<AssessmentStatus, { next: AssessmentStatus; label: string; className: string } | null> = {
  draft: { next: 'active', label: 'Activate (go live)', className: 'bg-green-600 text-white hover:bg-green-700' },
  active: { next: 'closed', label: 'Close assessment', className: 'bg-gray-800 text-white hover:bg-gray-900' },
  closed: null,
}

export default function AssessmentActions({ assessmentId, currentStatus, accessCode }: Props) {
  const supabase = createClient()
  const [status, setStatus] = useState<AssessmentStatus>(currentStatus)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const transition = STATUS_TRANSITIONS[status]

  async function handleStatusChange() {
    if (!transition) return
    setLoading(true)
    setError(null)
    const { error: updateError } = await supabase
      .from('assessments')
      .update({ status: transition.next })
      .eq('id', assessmentId)
    if (updateError) {
      setError(updateError.message)
    } else {
      setStatus(transition.next)
    }
    setLoading(false)
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(accessCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      {status === 'active' && (
        <div className="flex items-center gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div>
            <p className="text-xs text-blue-500 uppercase tracking-wider font-medium mb-0.5">Student Access Code</p>
            <p className="text-3xl font-bold tracking-widest text-blue-700 font-mono">{accessCode}</p>
          </div>
          <button
            onClick={handleCopy}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-700 border border-blue-300 rounded-lg hover:bg-blue-100 transition-colors"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      )}

      {status === 'closed' && (
        <div className="px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600">
          This assessment is closed. No further sessions can be started.
        </div>
      )}

      {transition && (
        <button
          onClick={handleStatusChange}
          disabled={loading}
          className={`w-full py-2.5 px-4 text-sm font-medium rounded-xl transition-colors disabled:opacity-50 ${transition.className}`}
        >
          {loading ? 'Updating…' : transition.label}
        </button>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
    </div>
  )
}
