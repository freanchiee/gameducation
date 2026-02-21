'use client'

import { useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Square, ChevronDown, ChevronUp } from 'lucide-react'

export type ExaminerMessage = { role: 'ai' | 'student'; content: string; timestamp: string }

export interface EvidenceProgress {
  criterion: string
  label: string
  collected: number
  required: number
  sufficient: boolean
}

export interface ExaminerPanelProps {
  aiState: 'idle' | 'listening' | 'processing' | 'speaking'
  messages: ExaminerMessage[]
  currentQuestion: string
  taskProgress: { completed: number; total: number; currentSequence: number }
  evidenceProgress: EvidenceProgress[]
  isRecording: boolean
  waveform?: number[]
  elapsed?: number
  onStartRecording: () => void
  onStopRecording: () => void
  onSubmitVoice: () => void
  disabled?: boolean
  allowTextInput?: boolean
  onTextSubmit?: (text: string) => void
}

const WAVE_BARS = 20

function formatSeconds(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

export default function ExaminerPanel({
  aiState,
  messages,
  currentQuestion,
  taskProgress,
  evidenceProgress,
  isRecording,
  waveform = Array(WAVE_BARS).fill(0.08),
  elapsed = 0,
  onStartRecording,
  onStopRecording,
  onSubmitVoice,
  disabled,
  allowTextInput,
  onTextSubmit,
}: ExaminerPanelProps) {
  const [textInput, setTextInput] = useState('')
  const [feedExpanded, setFeedExpanded] = useState(true)
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight
    }
  }, [messages])

  function submitText() {
    if (!textInput.trim() || !onTextSubmit) return
    onTextSubmit(textInput.trim())
    setTextInput('')
  }

  const progressPct = taskProgress.total > 0
    ? Math.round((taskProgress.completed / taskProgress.total) * 100)
    : 0

  return (
    <aside className="flex flex-col h-full bg-white border-l border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex-none px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600">AI Examiner</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Task {taskProgress.currentSequence} of {taskProgress.total}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full transition-colors ${
              aiState === 'speaking' ? 'bg-blue-500 animate-pulse' :
              aiState === 'processing' ? 'bg-amber-400 animate-pulse' :
              aiState === 'listening' ? 'bg-green-500 animate-pulse' :
              'bg-gray-300'
            }`} />
            <span className="text-[11px] text-gray-500">
              {aiState === 'speaking' ? 'Speaking' :
               aiState === 'processing' ? 'Thinking...' :
               aiState === 'listening' ? 'Listening' : 'Ready'}
            </span>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-gray-400 mb-1">
            <span>Session progress</span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Evidence progress */}
      {evidenceProgress.length > 0 && (
        <div className="flex-none px-4 py-2 border-b border-gray-100 bg-gray-50 space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Evidence collected</p>
          {evidenceProgress.map((ep) => (
            <div key={ep.criterion} className="flex items-center gap-2">
              <span className={`text-[11px] font-bold w-8 ${ep.sufficient ? 'text-green-600' : 'text-gray-600'}`}>
                {ep.label}
              </span>
              <div className="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${ep.sufficient ? 'bg-green-500' : 'bg-blue-400'}`}
                  style={{ width: `${Math.min(100, (ep.collected / Math.max(ep.required, 1)) * 100)}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400 w-8 text-right">{ep.collected}/{ep.required}</span>
              {ep.sufficient && <span className="text-green-500 text-[10px]">✓</span>}
            </div>
          ))}
        </div>
      )}

      {/* Current AI question */}
      {currentQuestion && (
        <div className="flex-none px-4 py-3 border-b border-gray-100 bg-blue-50">
          <p className="text-[10px] font-semibold text-blue-600 uppercase tracking-wide mb-1">Examiner prompt</p>
          <p className="text-sm text-blue-900 leading-snug">{currentQuestion}</p>
        </div>
      )}

      {/* Conversation feed */}
      <div className="flex-none border-b border-gray-100">
        <button
          onClick={() => setFeedExpanded((v) => !v)}
          className="w-full px-4 py-2 flex items-center justify-between text-[11px] font-medium text-gray-600 hover:bg-gray-50"
        >
          <span>Conversation ({messages.length})</span>
          {feedExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      </div>

      {feedExpanded && (
        <div
          ref={feedRef}
          className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-2"
        >
          {messages.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Your conversation will appear here.</p>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'student' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-xl px-3 py-2 text-xs leading-snug ${
                  msg.role === 'ai'
                    ? 'bg-gray-100 text-gray-800 rounded-tl-none'
                    : 'bg-blue-600 text-white rounded-tr-none'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))
          )}
          {aiState === 'processing' && (
            <div className="flex justify-start">
              <div className="bg-gray-100 rounded-xl rounded-tl-none px-3 py-2 flex gap-1">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Voice controls */}
      <div className="flex-none border-t border-gray-200 p-3 bg-gray-50 space-y-2">
        {/* Waveform + timer */}
        {isRecording && (
          <div className="flex items-center gap-2 bg-white rounded-lg border border-gray-200 px-3 py-1.5">
            <div className="flex items-end gap-[2px] flex-1 h-6 overflow-hidden">
              {waveform.map((v, i) => (
                <span
                  key={i}
                  className="w-[2px] rounded-full bg-blue-400 transition-all"
                  style={{ height: `${Math.max(4, Math.round(v * 24))}px` }}
                />
              ))}
            </div>
            <span className="text-xs tabular-nums text-gray-400">{formatSeconds(elapsed)}</span>
          </div>
        )}

        <div className="flex gap-2">
          <button
            onClick={isRecording ? onStopRecording : onStartRecording}
            disabled={disabled && !isRecording}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              isRecording
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 disabled:cursor-not-allowed'
            }`}
          >
            {isRecording ? <><Square size={14} /> Stop</> : <><Mic size={14} /> Speak</>}
          </button>

          {isRecording && (
            <button
              onClick={onSubmitVoice}
              className="flex-shrink-0 px-3 py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white text-sm font-medium transition-colors"
            >
              Send ↑
            </button>
          )}
        </div>

        {allowTextInput && onTextSubmit && (
          <div className="flex gap-2">
            <input
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitText() } }}
              placeholder="Type your answer..."
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white"
              disabled={disabled}
            />
            <button
              onClick={submitText}
              disabled={disabled || !textInput.trim()}
              className="px-3 py-2 rounded-lg bg-gray-800 text-white text-sm hover:bg-gray-700 disabled:opacity-50"
            >
              ↑
            </button>
          </div>
        )}

        <p className="text-[10px] text-gray-400 text-center">
          {isRecording ? 'Recording — speak your answer' :
           disabled ? 'Waiting for AI...' : 'Press Speak to answer vocally'}
        </p>
      </div>
    </aside>
  )
}
