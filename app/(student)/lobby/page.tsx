'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LobbyPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ access_code: code.toUpperCase().trim(), student_name: name.trim() }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error ?? 'Invalid code or session unavailable.')
      setLoading(false)
      return
    }

    // Store session token for this assessment (no auth required)
    sessionStorage.setItem('voiceiq_session_id', data.session_id)
    sessionStorage.setItem('voiceiq_participant_id', data.participant_id)
    sessionStorage.setItem('voiceiq_student_name', name.trim())

    router.push(`/session/${data.session_id}`)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#ece8c7] px-4">
      <div className="max-w-md w-full space-y-8 p-8 gd-surface">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-[#223a83]">VoiceIQ</h1>
          <p className="mt-2 text-[#516079]">Your oral assessment starts here</p>
        </div>

        <form onSubmit={handleJoin} className="space-y-5">
          {error && (
            <div className="p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="code" className="block text-sm font-medium text-[#223a83] mb-2">
              Access Code
            </label>
            <input
              id="code"
              type="text"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-4 text-center text-3xl font-bold tracking-[0.5em] uppercase rounded-xl gd-input"
              placeholder="XXXXXX"
              autoComplete="off"
            />
            <p className="mt-1 text-xs text-[#687891] text-center">
              6-character code from your teacher
            </p>
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-[#223a83] mb-2">
              Your full name
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl gd-input"
              placeholder="e.g. Priya Sharma"
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6 || name.trim().length < 2}
            className="w-full py-4 rounded-xl font-semibold text-lg gd-button disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Joining...' : 'Join Assessment'}
          </button>
        </form>

        <p className="text-center text-xs text-[#687891]">
          No account needed. Your teacher will see your results.
        </p>
      </div>
    </div>
  )
}
