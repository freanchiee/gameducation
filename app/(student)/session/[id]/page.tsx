'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import VoiceInterface from '@/components/assessment/VoiceInterface'
import ConversationFeed from '@/components/assessment/ConversationFeed'
import type { Message } from '@/lib/types'

type AIState = 'idle' | 'listening' | 'processing' | 'speaking'

export default function SessionPage() {
  const { id: sessionId } = useParams<{ id: string }>()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [aiState, setAiState] = useState<AIState>('idle')
  const [questionNumber, setQuestionNumber] = useState(1)
  const [maxQuestions, setMaxQuestions] = useState(6)
  const [studentName, setStudentName] = useState('')
  const [participantId, setParticipantId] = useState('')
  const [allowTextInput, setAllowTextInput] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

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
        voices.find((v) => /Google US English|Samantha|Daniel|Microsoft/i.test(v.name)) ??
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
      startSession(sName, pId)
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

  async function startSession(name: string, pId: string) {
    setAiState('processing')
    try {
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

      if (!res.ok) throw new Error('Failed to start session')

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
      setAiState('speaking')

      // Text-to-speech
      speakQuestion(data.question, () => setAiState('idle'))
    } catch {
      setError('Failed to start session. Please refresh and try again.')
      setAiState('idle')
    }
  }

  async function handleStudentResponse(transcript: string) {
    if (!transcript.trim()) return

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

    const nextQ = questionNumber + 1

    if (nextQ > maxQuestions) {
      await finishSession(nextMessages)
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
        }),
      })

      if (!res.ok) throw new Error('AI question failed')

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

      setMessages([...nextMessages, aiMessage])
      setQuestionNumber(nextQ)
      setAiState('speaking')

      speakQuestion(data.question, () => setAiState('idle'))
    } catch {
      setError('Connection issue. Please wait a moment then try again.')
      setAiState('idle')
    }
  }

  async function finishSession(finalMessages: Message[]) {
    setAiState('processing')
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

      if (!res.ok) throw new Error('Evaluation failed')

      const data = await res.json()
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
    </div>
  )
}
