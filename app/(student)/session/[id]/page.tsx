'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import VoiceInterface from '@/components/assessment/VoiceInterface'
import ConversationFeed from '@/components/assessment/ConversationFeed'
import type { Message } from '@/lib/types'

type AIState = 'idle' | 'listening' | 'processing' | 'speaking'
type ConceptTracker = {
  target_concepts: string[]
  covered_concepts: string[]
  current_concept: string
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
  const [conceptFocus, setConceptFocus] = useState('')
  const [studentName, setStudentName] = useState('')
  const [participantId, setParticipantId] = useState('')
  const [allowTextInput, setAllowTextInput] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [debugEvents, setDebugEvents] = useState<string[]>([])
  const initialized = useRef(false)
  const requestInFlightRef = useRef(false)
  const debugEnabled = searchParams.get('debug') === '1'

  function logDebug(message: string, meta?: unknown) {
    const timestamp = new Date().toISOString().slice(11, 19)
    const line = `${timestamp} ${message}`
    console.log('[session-debug]', line, meta ?? '')
    if (!debugEnabled) return
    setDebugEvents((prev) => [...prev.slice(-14), meta ? `${line} ${JSON.stringify(meta)}` : line])
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

    const applyPreferredVoice = () => {
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
    applyPreferredVoice()

    if (!utterance.voice && synth.getVoices().length === 0) {
      const previous = synth.onvoiceschanged
      synth.onvoiceschanged = () => {
        applyPreferredVoice()
        synth.speak(utterance)
        synth.onvoiceschanged = previous ?? null
      }
      setTimeout(() => {
        if (synth.speaking) return
        synth.speak(utterance)
      }, 150)
      return
    }

    synth.speak(utterance)
  }

  useEffect(() => {
    const sName = sessionStorage.getItem('voiceiq_student_name') ?? 'Student'
    const pId = sessionStorage.getItem('voiceiq_participant_id') ?? ''
    setStudentName(sName)
    setParticipantId(pId)
    void loadTypingPermission(pId)

    if (!initialized.current) {
      initialized.current = true
      recoverOrStartSession(sName, pId)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTypingPermission(pId: string) {
    if (!pId) return

    try {
      const res = await fetch(
        `/api/participants/${pId}/typing?session_id=${encodeURIComponent(sessionId)}`
      )

      if (!res.ok) {
        setAllowTextInput(false)
        return
      }

      const data = await res.json()
      setAllowTextInput(Boolean(data.allow_text_input))
    } catch {
      setAllowTextInput(false)
    }
  }

  async function recoverOrStartSession(name: string, pId: string) {
    // Try to recover existing messages from DB (if page refreshed mid-session)
    try {
      const res = await fetch(`/api/transcripts?session_id=${sessionId}`)
      if (res.ok) {
        const data = await res.json()
        const existingMessages = data.messages as Message[]
        if (existingMessages.length > 0) {
          // Session in progress — restore state
          const aiMessages = existingMessages.filter(m => m.role === 'ai')
          setMessages(existingMessages)
          setQuestionNumber(aiMessages.length + 1)
          setAiState('idle')
          return
        }
      }
    } catch {
      // If recovery fails, proceed to start fresh
    }

    // No existing messages — start from beginning
    startSession(name, pId)
  }

  async function startSession(name: string, pId: string) {
    if (requestInFlightRef.current) return
    requestInFlightRef.current = true
    setAiState('processing')
    try {
      logDebug('startSession request', { sessionId, participantId: pId })
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

      if (!res.ok) {
        const text = await res.text()
        logDebug('startSession failed', { status: res.status, body: text })
        throw new Error(`Failed to start session (${res.status})`)
      }

      const data = await res.json()
      logDebug('startSession success', {
        maxQuestions: data.max_questions,
        conceptFocus: data.concept_focus,
        coveredConcepts: data.concept_tracker?.covered_concepts?.length ?? 0,
      })
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
      if (data.concept_focus) setConceptFocus(String(data.concept_focus))
      setAiState('speaking')

      // Text-to-speech
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
    logDebug('student response received', {
      questionNumber,
      transcriptLength: transcript.length,
      historySize: nextMessages.length,
    })

    // Fire-and-forget: persist student message to DB
    fetch('/api/transcripts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        participant_id: participantId,
        role: 'student',
        content: transcript,
      }),
    }).catch(() => {}) // Ignore errors; message is in React state anyway

    const nextQ = questionNumber + 1
    if (nextQ > maxQuestions) {
      await finishSession(nextMessages, nextQ)
      requestInFlightRef.current = false
      return
    }

    try {
      const res = await fetch('/api/ai/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          participant_id: participantId,
          conversation_history: nextMessages,
          student_name: studentName,
          question_number: nextQ,
          concept_tracker: conceptTracker,
        }),
      })

      if (!res.ok) {
        const text = await res.text()
        logDebug('ai/question failed', { status: res.status, body: text, nextQ })
        throw new Error(`AI question failed (${res.status})`)
      }

      const data = await res.json()
      logDebug('ai/question success', {
        nextQ,
        responseChars: (data.question ?? '').length,
        shouldFinish: Boolean(data.should_finish),
        conceptFocus: data.concept_focus,
        coveredConcepts: data.concept_tracker?.covered_concepts?.length ?? 0,
      })
      if (data.concept_tracker) setConceptTracker(data.concept_tracker as ConceptTracker)
      if (data.concept_focus) setConceptFocus(String(data.concept_focus))
      if (data.should_finish) {
        await finishSession(nextMessages, nextQ)
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

      setMessages([...nextMessages, aiMessage])
      setQuestionNumber(nextQ)
      setAiState('speaking')

      speakQuestion(data.question, () => setAiState('idle'))
    } catch {
      setError('Connection issue. Please wait a moment then try again.')
      setAiState('idle')
    } finally {
      requestInFlightRef.current = false
    }
  }

  async function finishSession(finalMessages: Message[], nextQ: number) {
    setAiState('processing')
    logDebug('finishSession start', { nextQ, historySize: finalMessages.length })
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

      if (!res.ok) {
        const text = await res.text()
        logDebug('ai/evaluate failed', { status: res.status, body: text })
        throw new Error(`Evaluation failed (${res.status})`)
      }

      const data = await res.json()
      logDebug('finishSession success', { evaluationId: data.evaluation_id })
      router.push(`/results/${data.evaluation_id}`)
    } catch {
      setError('Could not generate evaluation. Please contact your teacher.')
      setAiState('idle')
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#ece8c7]">
        <div className="max-w-md p-6 gd-surface text-center">
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#ece8c7] flex flex-col">
      {/* Header */}
      <div className="bg-[#d3e3e7] border-b border-[#b6c9cf] px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold text-[#223a83]">VoiceIQ Assessment</h1>
        <div className="flex items-center gap-3 text-sm text-[#44597f]">
          {conceptTracker && (
            <span className="hidden md:inline">
              Concepts {conceptTracker.covered_concepts.length}/{conceptTracker.target_concepts.length}
              {conceptFocus ? ` • ${conceptFocus}` : ''}
            </span>
          )}
          <span>{studentName}</span>
          <span className="px-2 py-0.5 bg-[#ece6bf] text-[#24408f] rounded-full font-medium border border-[#c9be86]">
            Q {Math.min(questionNumber, maxQuestions)} / {maxQuestions}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[#d7dcdf]">
        <div
          className="h-1 bg-[#24408f] transition-all duration-500"
          style={{ width: `${((questionNumber - 1) / maxQuestions) * 100}%` }}
        />
      </div>

      {/* Conversation */}
      <div className="flex-1 overflow-hidden">
        <ConversationFeed messages={messages} aiState={aiState} />
      </div>

      {/* Voice interface */}
      <VoiceInterface
        aiState={aiState}
        onResponse={handleStudentResponse}
        disabled={aiState !== 'idle'}
        allowTextInput={allowTextInput}
      />
      {debugEnabled && (
        <div className="fixed right-3 bottom-3 w-[420px] max-h-56 overflow-auto rounded-lg border border-[#9db1be] bg-white/90 text-[11px] p-2 space-y-1 shadow-lg">
          <p className="font-semibold text-[#223a83]">Session Debug</p>
          {debugEvents.length === 0 ? (
            <p className="text-[#667696]">No events yet.</p>
          ) : (
            debugEvents.map((entry, idx) => (
              <p key={idx} className="text-[#2f3d56] leading-snug">{entry}</p>
            ))
          )}
        </div>
      )}
    </div>
  )
}
