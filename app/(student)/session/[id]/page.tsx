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
  const [error, setError] = useState<string | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    const sName = sessionStorage.getItem('voiceiq_student_name') ?? 'Student'
    const pId = sessionStorage.getItem('voiceiq_participant_id') ?? ''
    setStudentName(sName)
    setParticipantId(pId)

    if (!initialized.current) {
      initialized.current = true
      startSession(sName, pId)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (window.speechSynthesis) {
        const utt = new SpeechSynthesisUtterance(data.question)
        utt.onend = () => setAiState('idle')
        window.speechSynthesis.speak(utt)
      } else {
        setAiState('idle')
      }
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

      if (window.speechSynthesis) {
        const utt = new SpeechSynthesisUtterance(data.question)
        utt.onend = () => setAiState('idle')
        window.speechSynthesis.speak(utt)
      } else {
        setAiState('idle')
      }
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md p-6 bg-white rounded-xl border text-center">
          <p className="text-red-600 font-medium">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <h1 className="font-semibold text-gray-900">VoiceIQ Assessment</h1>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <span>{studentName}</span>
          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full font-medium">
            Q {Math.min(questionNumber, maxQuestions)} / {maxQuestions}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100">
        <div
          className="h-1 bg-blue-500 transition-all duration-500"
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
      />
    </div>
  )
}
