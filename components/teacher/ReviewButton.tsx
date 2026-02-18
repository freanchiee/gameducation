'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CheckCircle } from 'lucide-react'

interface Props {
  evaluationId: string
  reviewed: boolean
}

export default function ReviewButton({ evaluationId, reviewed: initialReviewed }: Props) {
  const supabase = createClient()
  const [reviewed, setReviewed] = useState(initialReviewed)
  const [loading, setLoading] = useState(false)

  async function markReviewed() {
    if (reviewed) return
    setLoading(true)
    await supabase
      .from('evaluations')
      .update({ reviewed_by_teacher: true })
      .eq('id', evaluationId)
    setReviewed(true)
    setLoading(false)
  }

  if (reviewed) {
    return (
      <span className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 rounded-lg">
        <CheckCircle size={16} />
        Reviewed
      </span>
    )
  }

  return (
    <button
      onClick={markReviewed}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
    >
      <CheckCircle size={16} />
      {loading ? 'Saving…' : 'Mark as reviewed'}
    </button>
  )
}
