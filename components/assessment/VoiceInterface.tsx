'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ArrowUp, Mic, Plus, Send, Settings2, Square, X } from 'lucide-react'

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

const AUTO_PAUSE_MS = 3000
const STITCH_GRACE_MS = 5000
const SILENCE_CHECK_MS = 250
const SPEECH_RMS_THRESHOLD = 0.03
const WAVE_BARS = 24

function formatSeconds(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function VoiceInterface({
  aiState,
  onResponse,
  disabled,
  allowTextInput,
}: VoiceInterfaceProps) {
  const [isRecording, setIsRecording] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const [draftTranscript, setDraftTranscript] = useState('')
  const [micError, setMicError] = useState<string | null>(null)
  const [textFallback, setTextFallback] = useState(false)
  const [textInput, setTextInput] = useState('')
  const [showMicSetup, setShowMicSetup] = useState(false)
  const [micPermission, setMicPermission] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown')
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [checkingMic, setCheckingMic] = useState(false)
  const [micCheckResult, setMicCheckResult] = useState<string | null>(null)
  const [waveform, setWaveform] = useState<number[]>(Array.from({ length: WAVE_BARS }, () => 0.08))
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [autoPauseActive, setAutoPauseActive] = useState(false)
  const [graceSecondsLeft, setGraceSecondsLeft] = useState(0)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const manuallyStoppedRef = useRef(false)
  const shouldRestartRef = useRef(false)
  const finalSegmentsRef = useRef<string[]>([])
  const interimSegmentRef = useRef('')
  const startedAtRef = useRef<number>(0)
  const speechLastDetectedAtRef = useRef<number>(0)
  const autoPauseActiveRef = useRef(false)

  const meterStreamRef = useRef<MediaStream | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const freqDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const timeDataRef = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const lastWaveUpdateRef = useRef(0)

  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const silenceIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const graceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const graceTickIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const speechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => {
    if (!speechSupported) {
      setMicError('Speech recognition is not available in this browser.')
      setTextFallback(allowTextInput)
    }
  }, [allowTextInput, speechSupported])

  useEffect(() => {
    autoPauseActiveRef.current = autoPauseActive
  }, [autoPauseActive])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!sessionStorage.getItem('voiceiq_mic_setup_done')) {
      setShowMicSetup(true)
    }
    void refreshMicDiagnostics()
  }, [])

  useEffect(() => {
    if (!isRecording || !startedAtRef.current) return
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)

    timerIntervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000)
      setElapsedSeconds(Math.max(0, elapsed))
    }, 1000)

    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current)
      timerIntervalRef.current = null
    }
  }, [isRecording])

  useEffect(() => {
    if (disabled && isRecording) {
      stopAndKeepDraft()
    }
  }, [disabled, isRecording])

  useEffect(() => {
    return () => {
      clearRecognitionTimers()
      stopMetering()
      recognitionRef.current?.stop()
    }
  }, [])

  function clearRecognitionTimers() {
    if (silenceIntervalRef.current) clearInterval(silenceIntervalRef.current)
    if (graceTimeoutRef.current) clearTimeout(graceTimeoutRef.current)
    if (graceTickIntervalRef.current) clearInterval(graceTickIntervalRef.current)
    silenceIntervalRef.current = null
    graceTimeoutRef.current = null
    graceTickIntervalRef.current = null
  }

  function stopMetering() {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = null
    }
    if (audioContextRef.current) {
      void audioContextRef.current.close()
      audioContextRef.current = null
    }
    if (meterStreamRef.current) {
      meterStreamRef.current.getTracks().forEach((track) => track.stop())
      meterStreamRef.current = null
    }
    analyserRef.current = null
    freqDataRef.current = null
    timeDataRef.current = null
    setWaveform(Array.from({ length: WAVE_BARS }, () => 0.08))
  }

  function startMetering(stream: MediaStream) {
    stopMetering()

    meterStreamRef.current = stream
    const audioContext = new AudioContext()
    const source = audioContext.createMediaStreamSource(stream)
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.82
    source.connect(analyser)

    audioContextRef.current = audioContext
    analyserRef.current = analyser
    freqDataRef.current = new Uint8Array(analyser.frequencyBinCount) as Uint8Array<ArrayBuffer>
    timeDataRef.current = new Uint8Array(analyser.fftSize) as Uint8Array<ArrayBuffer>

    const tick = (now: number) => {
      const currentAnalyser = analyserRef.current
      const freqData = freqDataRef.current
      const timeData = timeDataRef.current
      if (!currentAnalyser || !freqData || !timeData) return

      currentAnalyser.getByteFrequencyData(freqData)
      currentAnalyser.getByteTimeDomainData(timeData)

      let sumSquares = 0
      for (let i = 0; i < timeData.length; i++) {
        const normalized = (timeData[i] - 128) / 128
        sumSquares += normalized * normalized
      }
      const rms = Math.sqrt(sumSquares / timeData.length)
      if (rms > SPEECH_RMS_THRESHOLD) {
        speechLastDetectedAtRef.current = Date.now()
        cancelPendingAutoSubmit()
      }

      if (now - lastWaveUpdateRef.current > 65) {
        const bucket = Math.max(1, Math.floor(freqData.length / WAVE_BARS))
        const next = Array.from({ length: WAVE_BARS }, (_, i) => {
          let total = 0
          for (let j = 0; j < bucket; j++) {
            total += freqData[i * bucket + j] ?? 0
          }
          const normalized = total / (bucket * 255)
          return Math.max(0.05, Math.min(1, normalized * 1.8))
        })
        setWaveform(next)
        lastWaveUpdateRef.current = now
      }

      animationRef.current = requestAnimationFrame(tick)
    }

    animationRef.current = requestAnimationFrame(tick)
  }

  function collectCombinedTranscript() {
    const finalText = finalSegmentsRef.current.join(' ').trim()
    const interimText = interimSegmentRef.current.trim()
    return `${finalText} ${interimText}`.replace(/\s+/g, ' ').trim()
  }

  function updateDraftFromBuffers() {
    setDraftTranscript(collectCombinedTranscript())
  }

  function startSilenceMonitor() {
    if (silenceIntervalRef.current) clearInterval(silenceIntervalRef.current)

    silenceIntervalRef.current = setInterval(() => {
      if (!shouldRestartRef.current) return
      const combined = collectCombinedTranscript()
      if (!combined) return
      const silenceFor = Date.now() - speechLastDetectedAtRef.current
      if (silenceFor >= AUTO_PAUSE_MS && !autoPauseActiveRef.current) {
        beginPendingAutoSubmit()
      }
    }, SILENCE_CHECK_MS)
  }

  function beginPendingAutoSubmit() {
    autoPauseActiveRef.current = true
    setAutoPauseActive(true)
    setGraceSecondsLeft(Math.ceil(STITCH_GRACE_MS / 1000))

    if (graceTimeoutRef.current) clearTimeout(graceTimeoutRef.current)
    if (graceTickIntervalRef.current) clearInterval(graceTickIntervalRef.current)

    const started = Date.now()
    graceTickIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - started
      const secondsLeft = Math.max(0, Math.ceil((STITCH_GRACE_MS - elapsed) / 1000))
      setGraceSecondsLeft(secondsLeft)
    }, 250)

    graceTimeoutRef.current = setTimeout(() => {
      void submitTranscript()
    }, STITCH_GRACE_MS)
  }

  function cancelPendingAutoSubmit() {
    if (!autoPauseActiveRef.current) return
    autoPauseActiveRef.current = false
    setAutoPauseActive(false)
    setGraceSecondsLeft(0)
    if (graceTimeoutRef.current) clearTimeout(graceTimeoutRef.current)
    if (graceTickIntervalRef.current) clearInterval(graceTickIntervalRef.current)
    graceTimeoutRef.current = null
    graceTickIntervalRef.current = null
  }

  async function refreshMicDiagnostics() {
    try {
      if (navigator.permissions?.query) {
        const result = await navigator.permissions.query({
          name: 'microphone' as PermissionName,
        })
        setMicPermission(result.state as 'granted' | 'denied' | 'prompt')
      }
    } catch {
      setMicPermission('unknown')
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const inputs = devices.filter((d) => d.kind === 'audioinput')
      setAudioInputs(inputs)
      if (!selectedDeviceId && inputs[0]?.deviceId) setSelectedDeviceId(inputs[0].deviceId)
    } catch {
      setAudioInputs([])
    }
  }

  async function runMicCheck() {
    setCheckingMic(true)
    setMicCheckResult(null)
    setMicError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
      })
      stream.getTracks().forEach((track) => track.stop())
      setMicPermission('granted')
      setMicCheckResult('Microphone is ready.')
      sessionStorage.setItem('voiceiq_mic_setup_done', '1')
      setTimeout(() => setShowMicSetup(false), 500)
      await refreshMicDiagnostics()
    } catch {
      setMicPermission('denied')
      setMicCheckResult('Microphone check failed. Allow microphone access and try again.')
      setMicError('Microphone is blocked or unavailable.')
    } finally {
      setCheckingMic(false)
    }
  }

  async function startRecording() {
    if (!speechSupported) {
      if (allowTextInput) setTextFallback(true)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
      })
      startMetering(stream)
    } catch {
      setMicError('Microphone permission is blocked. Allow mic access in browser settings.')
      if (allowTextInput) setTextFallback(true)
      setShowMicSetup(true)
      return
    }

    setMicError(null)
    autoPauseActiveRef.current = false
    setAutoPauseActive(false)
    setGraceSecondsLeft(0)
    manuallyStoppedRef.current = false
    shouldRestartRef.current = true
    finalSegmentsRef.current = []
    interimSegmentRef.current = ''
    setInterimTranscript('')
    setDraftTranscript('')
    setElapsedSeconds(0)
    startedAtRef.current = Date.now()
    speechLastDetectedAtRef.current = Date.now()

    const SpeechRecognition = window.SpeechRecognition ?? window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = navigator.language || 'en-US'

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript.trim()
        if (!transcript) continue

        speechLastDetectedAtRef.current = Date.now()
        cancelPendingAutoSubmit()

        if (event.results[i].isFinal) {
          finalSegmentsRef.current.push(transcript)
        } else {
          interim += `${transcript} `
        }
      }

      interimSegmentRef.current = interim.trim()
      setInterimTranscript(interimSegmentRef.current)
      updateDraftFromBuffers()
    }

    recognition.onerror = (event: SpeechRecognitionErrorEventLike) => {
      if (event.error === 'not-allowed') {
        setMicError('Microphone permission denied. Please allow mic and try again.')
        if (allowTextInput) setTextFallback(true)
      } else if (event.error === 'audio-capture') {
        setMicError('No microphone input detected. Check your selected input device.')
      } else if (event.error === 'network') {
        setMicError('Speech service network issue. Please retry.')
      } else if (event.error !== 'no-speech') {
        setMicError('Could not capture speech. Please retry.')
      }
    }

    recognition.onend = () => {
      if (shouldRestartRef.current && !manuallyStoppedRef.current && !disabled) {
        try {
          recognition.start()
          return
        } catch {
          setMicError('Voice capture interrupted. Please tap the mic again.')
        }
      }
      shouldRestartRef.current = false
      setIsRecording(false)
      cancelPendingAutoSubmit()
      clearRecognitionTimers()
      stopMetering()
      updateDraftFromBuffers()
    }

    recognitionRef.current = recognition
    recognition.start()
    setIsRecording(true)
    startSilenceMonitor()
  }

  function stopAndKeepDraft() {
    manuallyStoppedRef.current = true
    shouldRestartRef.current = false
    cancelPendingAutoSubmit()
    clearRecognitionTimers()
    recognitionRef.current?.stop()
    updateDraftFromBuffers()
    setIsRecording(false)
  }

  async function submitTranscript() {
    const combined = collectCombinedTranscript()
    stopAndKeepDraft()
    setInterimTranscript('')

    finalSegmentsRef.current = []
    interimSegmentRef.current = ''
    setDraftTranscript('')

    if (!combined) {
      setMicError('No speech captured yet. Speak first, then submit.')
      return
    }
    onResponse(combined)
  }

  function submitTextFallback() {
    if (!textInput.trim()) return
    onResponse(textInput.trim())
    setTextInput('')
  }

  if (textFallback && allowTextInput) {
    return (
      <div className="border-t border-[#b8c5d8] bg-[#f4f4f5] p-4">
        {micError && (
          <div className="mb-3 flex items-center gap-2 text-xs text-amber-700">
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
            className="flex-1 resize-none rounded-lg border border-[#4e5a75] bg-[#ece6bf] px-3 py-2 text-sm text-[#1f3779] placeholder:text-[#7b7f86] focus:outline-none focus:ring-2 focus:ring-[#24408f]"
            rows={3}
            disabled={disabled}
          />
          <button
            onClick={submitTextFallback}
            disabled={disabled || !textInput.trim()}
            className="gd-button rounded-lg px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    )
  }

  const currentTranscript = draftTranscript || interimTranscript
  const canSend = Boolean(currentTranscript.trim()) && !disabled

  return (
    <div className="relative border-t border-[#b8c5d8] bg-[#f4f4f5] p-4 md:p-5">
      {showMicSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-lg gd-surface p-6">
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-[#223a83]">Microphone Setup</h3>
                <p className="mt-1 text-sm text-[#516079]">Check permission and input device before starting.</p>
              </div>
              <button
                onClick={() => setShowMicSetup(false)}
                className="text-[#60728f] hover:text-[#223a83]"
                aria-label="Close microphone setup"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="text-sm text-[#3b5077]">
                Permission: <span className="font-medium">{micPermission}</span>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#223a83]">Input device</label>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="gd-input w-full rounded-lg px-3 py-2 text-sm"
                >
                  {audioInputs.length === 0 ? (
                    <option value="">Default microphone</option>
                  ) : (
                    audioInputs.map((d, idx) => (
                      <option key={d.deviceId || idx} value={d.deviceId}>
                        {d.label || `Microphone ${idx + 1}`}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {micCheckResult && (
                <p className={`text-sm ${micCheckResult.includes('ready') ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {micCheckResult}
                </p>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={runMicCheck}
                  disabled={checkingMic}
                  className="gd-button rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {checkingMic ? 'Checking...' : 'Run Mic Check'}
                </button>
                <button
                  onClick={() => setShowMicSetup(false)}
                  className="rounded-lg border border-[#aeb8ca] px-4 py-2 text-sm text-[#3b5077]"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentTranscript && (
        <div className="mx-auto mb-3 max-w-3xl rounded-xl border border-[#c9be86] bg-[#ece6bf] px-3 py-2 text-sm text-[#233a83]">
          {currentTranscript}
        </div>
      )}

      {autoPauseActive && (
        <div className="mx-auto mb-3 max-w-3xl rounded-xl border border-[#c9be86] bg-[#ece6bf] px-3 py-2 text-xs text-[#4f5d79]">
          Silence detected. Auto-submit in {graceSecondsLeft}s unless you continue speaking.
        </div>
      )}

      <div className="mx-auto flex w-full max-w-3xl items-center gap-2 rounded-[22px] border border-[#d7dbe4] bg-white px-2 py-2 shadow-sm">
        <button
          onClick={() => setShowMicSetup(true)}
          className="h-10 w-10 rounded-full text-[#7283a1] transition hover:bg-[#f2f4f8]"
          aria-label="Open microphone setup"
          type="button"
        >
          <Plus size={20} className="mx-auto" />
        </button>

        <button
          onClick={isRecording ? stopAndKeepDraft : startRecording}
          disabled={disabled && !isRecording}
          className={`h-10 w-10 rounded-full transition ${
            isRecording
              ? 'bg-[#1e2a43] text-white hover:bg-[#121d33]'
              : 'bg-[#24408f] text-white hover:bg-[#1e3577]'
          } disabled:cursor-not-allowed disabled:opacity-50`}
          aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          type="button"
        >
          {isRecording ? <Square size={16} className="mx-auto" /> : <Mic size={18} className="mx-auto" />}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex h-10 items-end gap-[3px] overflow-hidden rounded-md bg-[#fafbfd] px-2 py-1">
            {waveform.map((value, idx) => (
              <span
                key={idx}
                className={`w-[2px] rounded-full ${isRecording ? 'bg-[#1f2d4a]' : 'bg-[#c3cad8]'}`}
                style={{ height: `${Math.max(6, Math.round(value * 28))}px` }}
              />
            ))}
          </div>
        </div>

        <div className="w-12 text-right text-sm font-medium text-[#4c5b79]">{formatSeconds(elapsedSeconds)}</div>

        <button
          onClick={() => void submitTranscript()}
          disabled={!canSend}
          className="h-10 w-10 rounded-full bg-black text-white transition hover:bg-[#101010] disabled:cursor-not-allowed disabled:bg-[#c8cfdb]"
          aria-label="Submit voice response"
          type="button"
        >
          <ArrowUp size={18} className="mx-auto" />
        </button>
      </div>

      <div className="mt-2 text-center">
        <p className="text-xs text-[#667696]">
          {isRecording ? 'Listening continuously' : aiState === 'idle' ? 'Tap mic to speak' : 'Waiting for AI'}
        </p>
        {micError && (
          <p className="mt-1 text-xs text-amber-700">{micError}</p>
        )}
        {!allowTextInput && (
          <p className="mt-1 text-xs text-[#60728f]">Voice-only mode is enabled by your teacher.</p>
        )}
        {allowTextInput && !textFallback && (
          <button
            onClick={() => setTextFallback(true)}
            className="mt-1 inline-flex items-center gap-1 text-xs text-[#60728f] underline transition-colors hover:text-[#2b427f]"
          >
            <Settings2 size={12} />
            Can&apos;t use mic? Type instead
          </button>
        )}
      </div>
    </div>
  )
}
