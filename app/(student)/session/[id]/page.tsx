'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import VoiceInterface from '@/components/assessment/VoiceInterface'
import type { Message } from '@/lib/types'

type AIState = 'idle' | 'listening' | 'processing' | 'speaking'
type ConceptTracker = {
  target_concepts: string[]
  covered_concepts: string[]
  current_concept: string
}

function formatSeconds(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

// Animated orb representing the AI examiner
function AssessmentOrb({ aiState }: { aiState: AIState }) {
  return (
    <div className="relative flex items-center justify-center w-52 h-52 select-none">
      {/* Outermost expanding ring — only while AI is speaking */}
      {aiState === 'speaking' && (
        <>
          <div
            className="absolute w-52 h-52 rounded-full border border-blue-400/20 animate-ping"
            style={{ animationDuration: '2s' }}
          />
          <div
            className="absolute w-44 h-44 rounded-full border border-blue-400/25 animate-ping"
            style={{ animationDuration: '2s', animationDelay: '0.7s' }}
          />
        </>
      )}

      {/* Processing spinner ring */}
      {aiState === 'processing' && (
        <div
          className="absolute w-48 h-48 rounded-full border-2 border-amber-400/15 border-t-amber-400/60 animate-spin"
          style={{ animationDuration: '1.4s' }}
        />
      )}

      {/* Mid ring — slow pulse when idle or speaking */}
      <div
        className={`absolute w-36 h-36 rounded-full border transition-colors duration-700 ${
          aiState === 'speaking'
            ? 'border-blue-400/40 animate-pulse'
            : aiState === 'processing'
            ? 'border-amber-400/25'
            : 'border-blue-500/15 animate-pulse'
        }`}
        style={{ animationDuration: '3s' }}
      />

      {/* Core orb */}
      <div
        className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-700 ${
          aiState === 'speaking'
            ? 'bg-gradient-to-br from-blue-400 to-indigo-600 shadow-2xl shadow-blue-500/50 scale-110'
            : aiState === 'processing'
            ? 'bg-gradient-to-br from-amber-500/60 to-orange-600/60 shadow-lg shadow-amber-500/20 scale-95'
            : 'bg-gradient-to-br from-blue-600/80 to-indigo-700/80 shadow-md shadow-blue-900/40'
        }`}
      >
        {/* Inner dot */}
        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
          <div
            className={`rounded-full transition-all duration-500 ${
              aiState === 'processing'
                ? 'w-3 h-3 bg-amber-300 animate-pulse'
                : aiState === 'speaking'
                ? 'w-4 h-4 bg-white/90 animate-pulse'
                : 'w-3 h-3 bg-white/60'
            }`}
          />
        </div>
      </div>
    </div>
  )
}

export default function SessionPage() {
  const { id: sessionId } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [messages, setMessages] = useState<Message[]>([])
  const [aiState, setAiState] = useState<AIState>('idle')
  const [questionNumber, setQuestionNumber] = useState(1)
  const [maxQuestions, setMaxQuestions] = useState(6)
  const [conceptTracker, setConceptTracker] = useState<ConceptTracker | null>(null)
  const [studentName, setStudentName] = useState('')
  const [participantId, setParticipantId] = useState('')
  const [allowTextInput, setAllowTextInput] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // UI-specific state
  const [liveDraft, setLiveDraft] = useState('')
  const [sessionStartMs, setSessionStartMs] = useState(0)
  const [totalElapsed, setTotalElapsed] = useState(0)
  const [webcamReady, setWebcamReady] = useState(false)
  const [debugEvents, setDebugEvents] = useState<string[]>([])

  const initialized = useRef(false)
  const requestInFlightRef = useRef(false)
  const webcamVideoRef = useRef<HTMLVideoElement>(null)
  const debugEnabled = searchParams.get('debug') === '1'

  // Derive the current AI question from message history
  const currentAiQuestion = [...messages].reverse().find((m) => m.role === 'ai')?.content ?? ''

  // Session elapsed timer
  useEffect(() => {
    if (!sessionStartMs) return
    const id = setInterval(() => {
      setTotalElapsed(Math.floor((Date.now() - sessionStartMs) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [sessionStartMs])

  // Webcam self-view — silently ignore if denied
  useEffect(() => {
    let stream: MediaStream | null = null
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'user' }, audio: false })
      .then((s) => {
        stream = s
        if (webcamVideoRef.current) {
          webcamVideoRef.current.srcObject = s
          setWebcamReady(true)
        }
      })
      .catch(() => {})
    return () => {
      stream?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  useEffect(() => {
    const sName = sessionStorage.getItem('voiceiq_student_name') ?? 'Student'
    const pId = sessionStorage.getItem('voiceiq_participant_id') ?? ''
    setStudentName(sName)
    setParticipantId(pId)
    void loadTypingPermission(pId)

    if (!initialized.current) {
      initialized.current = true
      void resumeOrStart(sName, pId)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function logDebug(message: string, meta?: unknown) {
    const timestamp = new Date().toISOString().slice(11, 19)
    const line = `${timestamp} ${message}`
    console.log('[session-debug]', line, meta ?? '')
    if (!debugEnabled) return
    setDebugEvents((prev) => [...prev.slice(-14), meta ? `${line} ${JSON.stringify(meta)}` : line])
  }

  async function loadTypingPermission(pId: string) {
    if (!pId) return
    try {
      const res = await fetch(`/api/participants/${pId}/typing?session_id=${encodeURIComponent(sessionId)}`)
      if (res.ok) {
        const data = await res.json()
        setAllowTextInput(Boolean(data.allow_text_input))
      }
    } catch {
      setAllowTextInput(false)
    }
  }

  function speakQuestion(text: string, onDone: () => void) {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      onDone()
      return
    }
    const synth = window.speechSynthesis
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95
    utterance.pitch = 1
    utterance.volume = 1

    const applyVoice = () => {
      const voices = synth.getVoices()
      if (!voices.length) return
      const preferred =
        voices.find((v) => /Google US English|Google UK English|Microsoft Aria|Microsoft Jenny|Samantha|Daniel|Karen|Moira/i.test(v.name)) ??
        voices.find((v) => /Neural|Natural|Enhanced/i.test(v.name) && v.lang.toLowerCase().startsWith('en')) ??
        voices.find((v) => v.lang.toLowerCase().startsWith('en')) ??
        voices[0]
      if (preferred) utterance.voice = preferred
    }

    utterance.onend = onDone
    utterance.onerror = onDone
    synth.cancel()
    applyVoice()

    if (!utterance.voice && synth.getVoices().length === 0) {
      const prev = synth.onvoiceschanged
      synth.onvoiceschanged = () => {
        applyVoice()
        synth.speak(utterance)
        synth.onvoiceschanged = prev ?? null
      }
      setTimeout(() => { if (!synth.speaking) synth.speak(utterance) }, 150)
      return
    }
    synth.speak(utterance)
  }

  async function resumeOrStart(name: string, pId: string) {
    try {
      const res = await fetch(`/api/transcripts?session_id=${encodeURIComponent(sessionId)}`)
      if (res.ok) {
        const data = await res.json()
        const existing: Message[] = data.messages ?? []
        if (existing.length > 0) {
          logDebug('resuming session', { messageCount: existing.length })
          setMessages(existing)
          const aiMessages = existing.filter((m) => m.role === 'ai')
          setQuestionNumber(aiMessages.length)
          setSessionStartMs(Date.now())

          const lastMsg = existing[existing.length - 1]
          if (lastMsg.role === 'ai') {
            setAiState('speaking')
            speakQuestion(lastMsg.content, () => setAiState('idle'))
          } else {
            await fetchNextQuestion(name, pId, existing, aiMessages.length + 1)
          }
          return
        }
      }
    } catch {
      // Fall through to fresh start
    }
    startSession(name, pId)
  }

  async function startSession(name: string, pId: string) {
    if (requestInFlightRef.current) return
    requestInFlightRef.current = true
    setAiState('processing')
    try {
      logDebug('startSession', { sessionId, participantId: pId })
      const res = await fetch('/api/ai/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          participant_id: pId,
          conversation_history: [],
          student_name: name,
          question_number: 1,
        }),
      })
      if (!res.ok) throw new Error(`Failed to start session (${res.status})`)

      const data = await res.json()
      const aiMessage: Message = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        participant_id: null,
        role: 'ai',
        content: data.question,
        audio_url: null,
        timestamp: new Date().toISOString(),
      }
      setMessages([aiMessage])
      setMaxQuestions(data.max_questions ?? 6)
      if (data.concept_tracker) setConceptTracker(data.concept_tracker as ConceptTracker)
      setSessionStartMs(Date.now())
      setAiState('speaking')
      speakQuestion(data.question, () => setAiState('idle'))
    } catch {
      setError('Failed to start session. Please refresh and try again.')
      setAiState('idle')
    } finally {
      requestInFlightRef.current = false
    }
  }

  async function handleStudentResponse(transcript: string) {
    if (!transcript.trim()) return
    if (requestInFlightRef.current) {
      logDebug('dropped response while in flight', { questionNumber })
      return
    }
    requestInFlightRef.current = true

    const studentMessage: Message = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      participant_id: participantId,
      role: 'student',
      content: transcript,
      audio_url: null,
      timestamp: new Date().toISOString(),
    }
    const nextMessages = [...messages, studentMessage]
    setMessages(nextMessages)
    setAiState('processing')

    // Persist student message for session resume
    void fetch('/api/transcripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        participant_id: participantId || null,
        role: 'student',
        content: transcript,
      }),
    })

    const nextQ = questionNumber + 1
    if (nextQ > maxQuestions) {
      await finishSession(nextMessages, nextQ)
      requestInFlightRef.current = false
      return
    }

    await fetchNextQuestion(studentName, participantId, nextMessages, nextQ)
    requestInFlightRef.current = false
  }

  async function fetchNextQuestion(name: string, pId: string, history: Message[], nextQ: number) {
    try {
      const res = await fetch('/api/ai/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          participant_id: pId,
          conversation_history: history,
          student_name: name,
          question_number: nextQ,
          concept_tracker: conceptTracker,
        }),
      })
      if (!res.ok) throw new Error(`AI question failed (${res.status})`)

      const data = await res.json()
      if (data.concept_tracker) setConceptTracker(data.concept_tracker as ConceptTracker)
      if (data.should_finish) {
        await finishSession(history, nextQ)
        return
      }

      const aiMessage: Message = {
        id: crypto.randomUUID(),
        session_id: sessionId,
        participant_id: null,
        role: 'ai',
        content: data.question,
        audio_url: null,
        timestamp: new Date().toISOString(),
      }
      setMessages([...history, aiMessage])
      setQuestionNumber(nextQ)
      setAiState('speaking')
      speakQuestion(data.question, () => setAiState('idle'))
    } catch {
      setError('Connection issue. Please wait a moment then try again.')
      setAiState('idle')
    }
  }

  async function finishSession(finalMessages: Message[], nextQ: number) {
    setAiState('processing')
    logDebug('finishSession', { nextQ, historySize: finalMessages.length })
    try {
      const res = await fetch('/api/ai/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          participant_id: participantId,
          conversation_history: finalMessages,
          student_name: studentName,
        }),
      })
      if (!res.ok) throw new Error(`Evaluation failed (${res.status})`)
      const data = await res.json()
      router.push(`/results/${data.evaluation_id}`)
    } catch {
      setError('Could not generate evaluation. Please contact your teacher.')
      setAiState('idle')
    }
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-[#0d1117] flex items-center justify-center px-6">
        <div className="max-w-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
            <span className="text-2xl">⚠</span>
          </div>
          <p className="text-white/80 text-sm">{error}</p>
          <button
            onClick={() => { setError(null); void resumeOrStart(studentName, participantId) }}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 transition"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-[#0d1117] flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-none px-5 py-3 flex items-center justify-between border-b border-white/8">
        <span className="text-white/40 text-xs font-semibold tracking-widest uppercase">VoiceIQ</span>

        <div className="flex items-center gap-3">
          {/* Question progress dots */}
          <div className="flex gap-1.5">
            {Array.from({ length: maxQuestions }, (_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${
                  i < questionNumber ? 'bg-blue-400' : 'bg-white/15'
                }`}
              />
            ))}
          </div>
          <span className="text-white/30 text-xs">Q {questionNumber}/{maxQuestions}</span>
        </div>

        <span className="text-white/30 text-xs tabular-nums">{formatSeconds(totalElapsed)}</span>
      </div>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 min-h-0">

        {/* AI question caption */}
        <div className="w-full max-w-xl">
          {currentAiQuestion ? (
            <div className="rounded-2xl border border-white/8 bg-white/5 px-5 py-4 text-center backdrop-blur-sm">
              <p className="text-[10px] font-semibold text-blue-400/70 uppercase tracking-widest mb-2">AI Examiner</p>
              <p className="text-white/90 text-sm leading-relaxed">{currentAiQuestion}</p>
            </div>
          ) : aiState === 'processing' ? (
            <div className="rounded-2xl border border-white/8 bg-white/5 px-5 py-4 text-center">
              <span className="inline-flex gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400/60 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          ) : null}
        </div>

        {/* Animated orb */}
        <AssessmentOrb aiState={aiState} />

        {/* Live student speech caption */}
        <div className="w-full max-w-xl min-h-[48px] flex items-center justify-center">
          {liveDraft ? (
            <div className="w-full rounded-2xl border border-white/8 bg-white/4 px-5 py-3 text-center">
              <p className="text-white/60 text-sm italic leading-relaxed">{liveDraft}</p>
            </div>
          ) : aiState === 'idle' && currentAiQuestion ? (
            <p className="text-white/20 text-xs">Tap the mic below and speak your answer</p>
          ) : null}
        </div>

      </div>

      {/* ── Voice input bar ── */}
      <VoiceInterface
        aiState={aiState}
        onResponse={handleStudentResponse}
        disabled={aiState !== 'idle'}
        allowTextInput={allowTextInput}
        onDraftChange={setLiveDraft}
        variant="dark"
      />

      {/* ── Webcam self-view (bottom-right corner) ── */}
      {/* Video element always mounted so the ref is available once stream arrives */}
      <div
        className={`fixed bottom-[88px] right-4 w-28 h-20 rounded-xl overflow-hidden border border-white/15 shadow-xl transition-opacity duration-500 ${
          webcamReady ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <video
          ref={webcamVideoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-cover scale-x-[-1]"
        />
      </div>

      {/* ── Debug overlay ── */}
      {debugEnabled && (
        <div className="fixed left-3 bottom-3 w-[380px] max-h-52 overflow-auto rounded-lg border border-white/10 bg-black/80 text-[11px] p-2 space-y-1 shadow-xl">
          <p className="font-semibold text-blue-400">Session Debug</p>
          {debugEvents.length === 0 ? (
            <p className="text-white/30">No events yet.</p>
          ) : (
            debugEvents.map((entry, idx) => (
              <p key={idx} className="text-white/60 leading-snug">{entry}</p>
            ))
          )}
        </div>
      )}
    </div>
  )
}
