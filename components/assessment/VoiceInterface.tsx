'use client'

import { useState, useRef, useEffect } from 'react'
import { Mic, MicOff, Send, AlertCircle } from 'lucide-react'

type AIState = 'idle' | 'listening' | 'processing' | 'speaking'

interface VoiceInterfaceProps {
  aiState: AIState
  onResponse: (transcript: string) => void
  disabled: boolean
  allowTextInput: boolean
}

declare global {
  interface SpeechRecognitionResultLike {
    isFinal: boolean
    0: { transcript: string }
  }
  interface SpeechRecognitionEventLike extends Event {
    resultIndex: number
    results: SpeechRecognitionResultLike[]
  }
  interface SpeechRecognitionErrorEventLike extends Event {
    error: string
  }
  interface SpeechRecognitionLike {
    continuous: boolean
    interimResults: boolean
    lang: string
    onresult: ((event: SpeechRecognitionEventLike) => void) | null
    onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
    onend: (() => void) | null
    start: () => void
    stop: () => void
  }
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognitionLike
    SpeechRecognition: new () => SpeechRecognitionLike
  }
}

const STATE_LABELS: Record<AIState, string> = {
  idle: 'Tap to speak',
  listening: 'Listening...',
  processing: 'AI is thinking...',
  speaking: 'AI is speaking...',
}

const STATE_COLORS: Record<AIState, string> = {
  idle: 'bg-[#24408f] hover:bg-[#1f387e]',
  listening: 'bg-red-500 hover:bg-red-600',
  processing: 'bg-gray-400 cursor-not-allowed',
  speaking: 'bg-gray-400 cursor-not-allowed',
}

export default function VoiceInterface({
  aiState,
  onResponse,
  disabled,
  allowTextInput,
}: VoiceInterfaceProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [finalTranscript, setFinalTranscript] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [micError, setMicError] = useState<string | null>(null)
  const [textFallback, setTextFallback] = useState(false)
  const [textInput, setTextInput] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const speechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => {
    if (!speechSupported) {
      setMicError('Speech recognition is not available in this browser.')
      setTextFallback(allowTextInput)
    }
  }, [allowTextInput, speechSupported])

  async function startRecording() {
    if (!speechSupported) {
      if (allowTextInput) setTextFallback(true)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      stream.getTracks().forEach((track) => track.stop())
    } catch {
      setMicError('Microphone permission is blocked. Allow mic access in browser settings.')
      if (allowTextInput) setTextFallback(true)
      return
    }

    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
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

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (event.error === 'not-allowed') {
        setMicError('Microphone permission denied. Please allow mic and try again.')
        if (allowTextInput) setTextFallback(true)
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

  if (textFallback && allowTextInput) {
    return (
      <div className="border-t border-[#b8c5d8] bg-[#f4f4f5] p-4">
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
            className="flex-1 px-3 py-2 border border-[#4e5a75] bg-[#ece6bf] text-[#1f3779] placeholder:text-[#7b7f86] rounded-lg resize-none text-sm focus:outline-none focus:ring-2 focus:ring-[#24408f]"
            rows={3}
            disabled={disabled}
          />
          <button
            onClick={submitTextFallback}
            disabled={disabled || !textInput.trim()}
            className="px-4 py-2 gd-button rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    )
  }

  if (confirming) {
    return (
      <div className="border-t border-[#b8c5d8] bg-[#f4f4f5] p-4 space-y-3">
        <p className="text-sm font-medium text-[#2b427f]">Is this what you said?</p>
        <div className="p-3 bg-[#ece6bf] rounded-lg text-sm text-[#2b427f] border border-[#c9be86]">
          {finalTranscript}
        </div>
        <div className="flex gap-2">
          <button
            onClick={editResponse}
            className="flex-1 py-2 border border-[#aeb8ca] text-[#3b5077] rounded-lg text-sm font-medium hover:bg-[#eaedf5] transition-colors"
          >
            Edit
          </button>
          <button
            onClick={confirmResponse}
            className="flex-1 py-2 gd-button rounded-lg text-sm font-medium"
          >
            Confirm & Submit
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="border-t border-[#b8c5d8] bg-[#f4f4f5] p-6">
      {/* Interim transcript preview */}
      {(isRecording && (interimTranscript || finalTranscript)) && (
        <div className="mb-4 p-3 bg-[#ece6bf] border border-[#c9be86] rounded-lg text-sm min-h-[3rem]">
          <span className="text-[#2b427f]">{finalTranscript}</span>
          <span className="text-[#667696] italic">{interimTranscript}</span>
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
        <p className="text-sm text-[#516079] font-medium">
          {isRecording ? 'Tap to stop' : STATE_LABELS[aiState]}
        </p>
        {!textFallback && (
          <>
            {allowTextInput && (
              <button
                onClick={() => setTextFallback(true)}
                className="text-xs text-[#60728f] hover:text-[#2b427f] underline transition-colors"
              >
                Can&apos;t use mic? Type instead
              </button>
            )}
            {micError && (
              <p className="text-xs text-amber-600 text-center max-w-sm">{micError}</p>
            )}
            {!allowTextInput && (
              <p className="text-xs text-[#60728f] text-center max-w-sm">
                Voice-only mode is enabled by your teacher.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
