'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Send, AlertCircle } from 'lucide-react'

type AIState = 'idle' | 'listening' | 'processing' | 'speaking'

interface VoiceInterfaceProps {
  aiState: AIState
  onResponse: (transcript: string) => void
  disabled: boolean
}

declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognition
    SpeechRecognition: new () => SpeechRecognition
  }
}

const STATE_LABELS: Record<AIState, string> = {
  idle: 'Tap to speak',
  listening: 'Listening...',
  processing: 'AI is thinking...',
  speaking: 'AI is speaking...',
}

const STATE_COLORS: Record<AIState, string> = {
  idle: 'bg-blue-600 hover:bg-blue-700',
  listening: 'bg-red-500 hover:bg-red-600',
  processing: 'bg-gray-400 cursor-not-allowed',
  speaking: 'bg-gray-400 cursor-not-allowed',
}

export default function VoiceInterface({ aiState, onResponse, disabled }: VoiceInterfaceProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [textFallback, setTextFallback] = useState(false)
  const [textInput, setTextInput] = useState('')
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const speechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => {
    if (!speechSupported) {
      setTextFallback(true)
    }
  }, [speechSupported])

  function startRecording() {
    if (!speechSupported) return

    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = ''
      let final = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript + ' '
        } else {
          interim += event.results[i][0].transcript
        }
      }
      setInterimTranscript(interim)
      if (final) setFinalTranscript((prev) => prev + final)
    }

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'not-allowed') {
        setMicError('Microphone permission denied. Using text input instead.')
        setTextFallback(true)
      }
      setIsRecording(false)
    }

    recognition.onend = () => {
      setIsRecording(false)
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
    setFinalTranscript('')
    setInterimTranscript('')
  }

  function stopRecording() {
    recognitionRef.current?.stop()
    setIsRecording(false)
    setInterimTranscript('')

    const combined = finalTranscript.trim()
    if (combined) {
      setConfirming(true)
    }
  }

  function confirmResponse() {
    onResponse(finalTranscript.trim())
    setFinalTranscript('')
    setConfirming(false)
  }

  function editResponse() {
    setConfirming(false)
  }

  function submitTextFallback() {
    if (textInput.trim()) {
      onResponse(textInput.trim())
      setTextInput('')
    }
  }

  if (textFallback) {
    return (
      <div className="border-t border-gray-200 bg-white p-4">
        {micError && (
          <div className="flex items-center gap-2 text-xs text-amber-600 mb-3">
            <AlertCircle size={14} />
            {micError}
          </div>
        )}
        <div className="flex gap-2">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                submitTextFallback()
              }
            }}
            placeholder="Type your answer here..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
            disabled={disabled}
          />
          <button
            onClick={submitTextFallback}
            disabled={disabled || !textInput.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    )
  }

  if (confirming) {
    return (
      <div className="border-t border-gray-200 bg-white p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700">Is this what you said?</p>
        <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-800 border border-gray-200">
          {finalTranscript}
        </div>
        <div className="flex gap-2">
          <button
            onClick={editResponse}
            className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={confirmResponse}
            className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            Confirm & Submit
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-gray-200 bg-white p-6">
      {/* Interim transcript preview */}
      {(isRecording && (interimTranscript || finalTranscript)) && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg text-sm min-h-[3rem]">
          <span className="text-gray-800">{finalTranscript}</span>
          <span className="text-gray-400 italic">{interimTranscript}</span>
        </div>
      )}

      <div className="flex flex-col items-center gap-3">
        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled && !isRecording}
          className={`w-20 h-20 rounded-full text-white flex items-center justify-center transition-all shadow-lg ${
            isRecording
              ? 'bg-red-500 hover:bg-red-600 animate-pulse-slow scale-110'
              : STATE_COLORS[aiState]
          }`}
        >
          {isRecording ? <MicOff size={32} /> : <Mic size={32} />}
        </button>
        <p className="text-sm text-gray-500 font-medium">
          {isRecording ? 'Tap to stop' : STATE_LABELS[aiState]}
        </p>
        {!textFallback && (
          <button
            onClick={() => setTextFallback(true)}
            className="text-xs text-gray-400 hover:text-gray-600 underline transition-colors"
          >
            Can&apos;t use mic? Type instead
          </button>
        )}
      </div>
    </div>
  )
}
