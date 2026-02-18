'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Moon, Sun } from 'lucide-react'
import VoiceInterface from '@/components/assessment/VoiceInterface'
import type { Message } from '@/lib/types'

type AIState = 'idle' | 'listening' | 'processing' | 'speaking'
type ConceptTracker = {
  target_concepts: string[]
  covered_concepts: string[]
  current_concept: string
}

const THEME_KEY = 'voiceiq_ui_theme'

function formatSeconds(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

// ── Animated orb ────────────────────────────────────────────────────────────
// Ring opacities are tuned per-theme so they read on both dark and light bgs.
function AssessmentOrb({ aiState, dark }: { aiState: AIState; dark: boolean }) {
  const speakRing1 = dark ? 'border-blue-400/20' : 'border-blue-500/30'
  const speakRing2 = dark ? 'border-blue-400/25' : 'border-blue-500/35'
  const spinRingBase = dark ? 'border-amber-400/15 border-t-amber-400/60' : 'border-amber-500/20 border-t-amber-500/70'
  const midRingSpeak = dark ? 'border-blue-400/40' : 'border-blue-500/50'
  const midRingIdle = dark ? 'border-blue-500/15' : 'border-blue-500/25'
  const midRingProcess = dark ? 'border-amber-400/25' : 'border-amber-500/35'

  return (
    <div className="relative flex items-center justify-center w-52 h-52 select-none">
      {/* Expanding rings when speaking */}
      {aiState === 'speaking' && (
        <>
          <div
            className={`absolute w-52 h-52 rounded-full border ${speakRing1} animate-ping`}
            style={{ animationDuration: '2s' }}
          />
          <div
            className={`absolute w-44 h-44 rounded-full border ${speakRing2} animate-ping`}
            style={{ animationDuration: '2s', animationDelay: '0.7s' }}
          />
        </>
      )}

      {/* Spinner when processing */}
      {aiState === 'processing' && (
        <div
          className={`absolute w-48 h-48 rounded-full border-2 ${spinRingBase} animate-spin`}
          style={{ animationDuration: '1.4s' }}
        />
      )}

      {/* Mid ring */}
      <div
        className={`absolute w-36 h-36 rounded-full border transition-colors duration-700 animate-pulse ${
          aiState === 'speaking' ? midRingSpeak : aiState === 'processing' ? midRingProcess : midRingIdle
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

// ── Page ────────────────────────────────────────────────────────────────────
export default function SessionPage() {
  const { id: sessionId } = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const router = useRouter()

  // Session state
  const [messages, setMessages] = useState<Message[]>([])
  const [aiState, setAiState] = useState<AIState>('idle')
  const [questionNumber, setQuestionNumber] = useState(1)
  const [maxQuestions, setMaxQuestions] = useState(6)
  const [conceptTracker, setConceptTracker] = useState<ConceptTracker | null>(null)
  const [studentName, setStudentName] = useState('')
  const [participantId, setParticipantId] = useState('')
  const [allowTextInput, setAllowTextInput] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // UI state
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const [liveDraft, setLiveDraft] = useState('')
  const [sessionStartMs, setSessionStartMs] = useState(0)
  const [totalElapsed, setTotalElapsed] = useState(0)
  const [webcamReady, setWebcamReady] = useState(false)
  const [debugEvents, setDebugEvents] = useState<string[]>([])

  const initialized = useRef(false)
  const requestInFlightRef = useRef(false)
  const webcamVideoRef = useRef<HTMLVideoElement>(null)
  const debugEnabled = searchParams.get('debug') === '1'

  const dk = theme === 'dark'
  const currentAiQuestion = [...messages].reverse().find((m) => m.role === 'ai')?.content ?? ''

  // ── Theme ────────────────────────────────────────────────────────────────
  function toggleTheme() {
    const next: 'light' | 'dark' = dk ? 'light' : 'dark'
    setTheme(next)
    sessionStorage.setItem(THEME_KEY, next)
  }

  // ── Session timer ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionStartMs) return
    const id = setInterval(() => setTotalElapsed(Math.floor((Date.now() - sessionStartMs) / 1000)), 1000)
    return () => clearInterval(id)
  }, [sessionStartMs])

  // ── Webcam self-view ─────────────────────────────────────────────────────
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
    return () => { stream?.getTracks().forEach((t) => t.stop()) }
  }, [])

  // ── Mount ────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Restore theme preference set on the brief page
    const saved = sessionStorage.getItem(THEME_KEY) as 'light' | 'dark' | null
    if (saved) setTheme(saved)

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

  // ── Helpers ──────────────────────────────────────────────────────────────
  function logDebug(message: string, meta?: unknown) {
    const ts = new Date().toISOString().slice(11, 19)
    const line = `${ts} ${message}`
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
    } catch { setAllowTextInput(false) }
  }

  function speakQuestion(text: string, onDone: () => void) {
    if (typeof window === 'undefined' || !window.speechSynthesis) { onDone(); return }
    const synth = window.speechSynthesis
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 0.95; utterance.pitch = 1; utterance.volume = 1

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

    utterance.onend = onDone; utterance.onerror = onDone
    synth.cancel(); applyVoice()

    if (!utterance.voice && synth.getVoices().length === 0) {
      const prev = synth.onvoiceschanged
      synth.onvoiceschanged = () => { applyVoice(); synth.speak(utterance); synth.onvoiceschanged = prev ?? null }
      setTimeout(() => { if (!synth.speaking) synth.speak(utterance) }, 150)
      return
    }
    synth.speak(utterance)
  }

  // ── Session lifecycle ────────────────────────────────────────────────────
  async function resumeOrStart(name: string, pId: string) {
    try {
      const res = await fetch(`/api/transcripts?session_id=${encodeURIComponent(sessionId)}`)
      if (res.ok) {
        const data = await res.json()
        const existing: Message[] = data.messages ?? []
        if (existing.length > 0) {
          logDebug('resuming', { count: existing.length })
          setMessages(existing)
          const aiCount = existing.filter((m) => m.role === 'ai').length
          setQuestionNumber(aiCount)
          setSessionStartMs(Date.now())
          const last = existing[existing.length - 1]
          if (last.role === 'ai') {
            setAiState('speaking')
            speakQuestion(last.content, () => setAiState('idle'))
          } else {
            await fetchNextQuestion(name, pId, existing, aiCount + 1)
          }
          return
        }
      }
    } catch { /* fall through */ }
    startSession(name, pId)
  }

  async function startSession(name: string, pId: string) {
    if (requestInFlightRef.current) return
    requestInFlightRef.current = true
    setAiState('processing')
    try {
      const res = await fetch('/api/ai/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, participant_id: pId, conversation_history: [], student_name: name, question_number: 1 }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      setMessages([{ id: crypto.randomUUID(), session_id: sessionId, participant_id: null, role: 'ai', content: data.question, audio_url: null, timestamp: new Date().toISOString() }])
      setMaxQuestions(data.max_questions ?? 6)
      if (data.concept_tracker) setConceptTracker(data.concept_tracker as ConceptTracker)
      setSessionStartMs(Date.now())
      setAiState('speaking')
      speakQuestion(data.question, () => setAiState('idle'))
    } catch {
      setError('Failed to start session. Please refresh and try again.')
      setAiState('idle')
    } finally { requestInFlightRef.current = false }
  }

  async function handleStudentResponse(transcript: string) {
    if (!transcript.trim() || requestInFlightRef.current) return
    requestInFlightRef.current = true

    const studentMsg: Message = {
      id: crypto.randomUUID(), session_id: sessionId, participant_id: participantId,
      role: 'student', content: transcript, audio_url: null, timestamp: new Date().toISOString(),
    }
    const nextMessages = [...messages, studentMsg]
    setMessages(nextMessages)
    setAiState('processing')

    void fetch('/api/transcripts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, participant_id: participantId || null, role: 'student', content: transcript }),
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, participant_id: pId, conversation_history: history, student_name: name, question_number: nextQ, concept_tracker: conceptTracker }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      if (data.concept_tracker) setConceptTracker(data.concept_tracker as ConceptTracker)
      if (data.should_finish) { await finishSession(history, nextQ); return }

      const aiMsg: Message = { id: crypto.randomUUID(), session_id: sessionId, participant_id: null, role: 'ai', content: data.question, audio_url: null, timestamp: new Date().toISOString() }
      setMessages([...history, aiMsg])
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
    logDebug('finishSession', { nextQ })
    try {
      const res = await fetch('/api/ai/evaluate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, participant_id: participantId, conversation_history: finalMessages, student_name: studentName }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      router.push(`/results/${data.evaluation_id}`)
    } catch {
      setError('Could not generate evaluation. Please contact your teacher.')
      setAiState('idle')
    }
  }

  // ── Theme-derived classes ────────────────────────────────────────────────
  const outerBg = dk ? 'bg-[#0d1117]' : 'bg-[#f0f4f8]'
  const headerBorder = dk ? 'border-white/8' : 'border-gray-200'
  const headerBg = dk ? '' : 'bg-white/80 backdrop-blur-sm'
  const logoText = dk ? 'text-white/40' : 'text-gray-400'
  const dotFilled = dk ? 'bg-blue-400' : 'bg-blue-500'
  const dotEmpty = dk ? 'bg-white/15' : 'bg-gray-200'
  const qText = dk ? 'text-white/30' : 'text-gray-400'
  const timerText = dk ? 'text-white/30' : 'text-gray-400'
  const toggleBtn = dk
    ? 'text-white/30 hover:text-white/60 hover:bg-white/5'
    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'

  const captionCard = dk
    ? 'border border-white/8 bg-white/5 backdrop-blur-sm'
    : 'border border-gray-200 bg-white shadow-sm'
  const captionLabel = dk ? 'text-blue-400/70' : 'text-blue-500/80'
  const captionText = dk ? 'text-white/90' : 'text-gray-800'

  const draftCard = dk ? 'border border-white/8 bg-white/4' : 'border border-gray-100 bg-gray-50'
  const draftText = dk ? 'text-white/60' : 'text-gray-500'
  const hintText = dk ? 'text-white/20' : 'text-gray-300'

  const webcamBorder = dk ? 'border-white/15' : 'border-gray-300'

  // ── Error screen ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={`fixed inset-0 ${outerBg} flex items-center justify-center px-6`}>
        <div className="max-w-sm text-center space-y-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${dk ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'}`}>
            <span className="text-2xl">⚠</span>
          </div>
          <p className={`text-sm ${dk ? 'text-white/80' : 'text-gray-700'}`}>{error}</p>
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

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className={`fixed inset-0 ${outerBg} flex flex-col overflow-hidden transition-colors duration-300`}>

      {/* Header */}
      <div className={`flex-none px-5 py-3 flex items-center justify-between border-b ${headerBorder} ${headerBg}`}>
        <span className={`text-xs font-semibold tracking-widest uppercase ${logoText}`}>VoiceIQ</span>

        <div className="flex items-center gap-3">
          <div className="flex gap-1.5">
            {Array.from({ length: maxQuestions }, (_, i) => (
              <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${i < questionNumber ? dotFilled : dotEmpty}`} />
            ))}
          </div>
          <span className={`text-xs ${qText}`}>Q {questionNumber}/{maxQuestions}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-xs tabular-nums ${timerText}`}>{formatSeconds(totalElapsed)}</span>
          <button
            onClick={toggleTheme}
            aria-label={dk ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`p-1.5 rounded-full transition-colors ${toggleBtn}`}
          >
            {dk ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 min-h-0">

        {/* AI question caption */}
        <div className="w-full max-w-xl">
          {currentAiQuestion ? (
            <div className={`rounded-2xl px-5 py-4 text-center ${captionCard}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-widest mb-2 ${captionLabel}`}>AI Examiner</p>
              <p className={`text-sm leading-relaxed ${captionText}`}>{currentAiQuestion}</p>
            </div>
          ) : aiState === 'processing' ? (
            <div className={`rounded-2xl px-5 py-4 text-center ${captionCard}`}>
              <span className="inline-flex gap-1.5">
                {[0, 150, 300].map((delay) => (
                  <span key={delay} className="w-1.5 h-1.5 rounded-full bg-amber-400/60 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                ))}
              </span>
            </div>
          ) : null}
        </div>

        {/* Animated orb */}
        <AssessmentOrb aiState={aiState} dark={dk} />

        {/* Live student draft */}
        <div className="w-full max-w-xl min-h-[48px] flex items-center justify-center">
          {liveDraft ? (
            <div className={`w-full rounded-2xl px-5 py-3 text-center ${draftCard}`}>
              <p className={`text-sm italic leading-relaxed ${draftText}`}>{liveDraft}</p>
            </div>
          ) : aiState === 'idle' && currentAiQuestion ? (
            <p className={`text-xs ${hintText}`}>Tap the mic below and speak your answer</p>
          ) : null}
        </div>

      </div>

      {/* Voice input bar */}
      <VoiceInterface
        aiState={aiState}
        onResponse={handleStudentResponse}
        disabled={aiState !== 'idle'}
        allowTextInput={allowTextInput}
        onDraftChange={setLiveDraft}
        variant={theme}
      />

      {/* Webcam self-view */}
      <div
        className={`fixed bottom-[88px] right-4 w-28 h-20 rounded-xl overflow-hidden border shadow-xl transition-opacity duration-500 ${webcamBorder} ${webcamReady ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <video ref={webcamVideoRef} autoPlay muted playsInline className="w-full h-full object-cover scale-x-[-1]" />
      </div>

      {/* Debug overlay */}
      {debugEnabled && (
        <div className={`fixed left-3 bottom-3 w-[380px] max-h-52 overflow-auto rounded-lg border p-2 space-y-1 shadow-xl text-[11px] ${dk ? 'border-white/10 bg-black/80' : 'border-gray-200 bg-white/90'}`}>
          <p className={`font-semibold ${dk ? 'text-blue-400' : 'text-blue-600'}`}>Session Debug</p>
          {debugEvents.length === 0 ? (
            <p className={dk ? 'text-white/30' : 'text-gray-400'}>No events yet.</p>
          ) : (
            debugEvents.map((entry, idx) => (
              <p key={idx} className={`leading-snug ${dk ? 'text-white/60' : 'text-gray-600'}`}>{entry}</p>
            ))
          )}
        </div>
      )}
    </div>
  )
}
