'use client'

import { useEffect, useState } from 'react'

type Participant = {
  id: string
  session_id: string
  student_name: string | null
  allow_text_input: boolean
  joined_at: string
  sessions: {
    status: 'waiting' | 'active' | 'completed'
  }
}

export default function TypingPermissions({ assessmentId }: { assessmentId: string }) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  useEffect(() => {
    async function loadParticipants() {
      setLoading(true)
      setError(null)

      const res = await fetch(`/api/assessments/${assessmentId}/participants`)
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(data.error ?? 'Failed to load participants')
        setLoading(false)
        return
      }

      setParticipants(data.participants ?? [])
      setLoading(false)
    }

    void loadParticipants()
  }, [assessmentId])

  async function toggleTyping(participantId: string, nextValue: boolean) {
    setUpdatingId(participantId)
    setError(null)

    const res = await fetch(`/api/participants/${participantId}/typing`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allow_text_input: nextValue }),
    })

    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data.error ?? 'Failed to update permission')
      setUpdatingId(null)
      return
    }

    setParticipants((prev) =>
      prev.map((p) =>
        p.id === participantId ? { ...p, allow_text_input: nextValue } : p
      )
    )

    setUpdatingId(null)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
        Student Input Permissions
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Voice input is default. Enable typing only for specific students when needed.
      </p>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading participants...</p>
      ) : participants.length === 0 ? (
        <p className="text-sm text-gray-400">No participants yet.</p>
      ) : (
        <div className="space-y-2">
          {participants.map((p, index) => (
            <div
              key={p.id}
              className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {p.student_name?.trim() || `Student ${index + 1}`}
                </p>
                <p className="text-xs text-gray-400">
                  Session {p.session_id.slice(0, 8)} · {p.sessions?.status ?? 'active'}
                </p>
              </div>
              <button
                onClick={() => toggleTyping(p.id, !p.allow_text_input)}
                disabled={updatingId === p.id}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                  p.allow_text_input
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-gray-100 text-gray-600 border border-gray-200'
                }`}
              >
                {updatingId === p.id
                  ? 'Updating...'
                  : p.allow_text_input
                  ? 'Typing Allowed'
                  : 'Voice Only'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
