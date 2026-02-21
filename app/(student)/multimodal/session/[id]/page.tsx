'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Moon, Sun, AlertTriangle } from 'lucide-react'
import TaskPlayer, { type CanonicalTaskType } from '@/components/multimodal/TaskPlayer'
import ExaminerPanel, { type ExaminerMessage, type EvidenceProgress } from '@/components/multimodal/ExaminerPanel'
import type { TaskSubmission } from '@/components/multimodal/task-types'

type AIState = 'idle' | 'listening' | 'processing' | 'speaking'

type TaskRunConfig = {
  task_type?: string
  task_type_ui?: string
  title?: string
  prompt?: string
  simulation_url?: string | null
  difficulty_level?: number
  criterion?: string
}

type TaskRun = {
  id: string
  task_sequence: number
  criterion: string
  status: string
  task_config: TaskRunConfig
}

const WAVE_BARS = 20
const AUTO_PAUSE_MS = 3000
const STITCH_GRACE_MS = 4000

function speakText(text: string, onDone: () => void) {
  if (typeof window === 'undefined' || !window.speechSynthesis) { onDone(); return }
  const synth = window.speechSynthesis
  const utter = new SpeechSynthesisUtterance(text)
  utter.rate = 0.95; utter.pitch = 1; utter.volume = 1
  const voices = synth.getVoices()
  const preferred =
    voices.find((v) => /Google US English|Microsoft Aria|Microsoft Jenny|Samantha/i.test(v.name)) ??
    voices.find((v) => v.lang.toLowerCase().startsWith('en')) ??
    voices[0]
  if (preferred) utter.voice = preferred
  utter.onend = onDone; utter.onerror = onDone
  synth.cancel(); synth.speak(utter)
}

export default function MultimodalSessionPage() {
  const { id: sessionId } = useParams<{ id: string }>()
  const router = useRouter()

  // Session state
  const [participantId, setParticipantId] = useState('')
  const [studentName, setStudentName] = useState('Student')
  const [currentTaskRun, setCurrentTaskRun] = useState<TaskRun | null>(null)
  const [currentTaskRunId, setCurrentTaskRunId] = useState('')
  const [taskCompleted, setTaskCompleted] = useState(0)
  const [maxTasks, setMaxTasks] = useState(8)
  const [messages, setMessages] = useState<ExaminerMessage[]>([])
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [aiState, setAiState] = useState<AIState>('processing')
  const [error, setError] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [mobileWarningDismissed, setMobileWarningDismissed] = useState(false)
  const [evidenceSufficient, setEvidenceSufficient] = useState<Record<string, boolean>>({})

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [waveform, setWaveform] = useState<number[]>(Array(WAVE_BARS).fill(0.08))
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [allowTextInput, setAllowTextInput] = useState(false)

  // UI
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const dk = theme === 'dark'

  // Refs
  const initialized = useRef(false)
  const taskEventQueueRef = useRef<Array<{ event_type: string; event_data: Record<string, unknown>; timestamp: string }>>([])
  const recognitionRef = useRef<any>(null)
  const finalSegmentsRef = useRef<string[]>([])
  const interimSegmentRef = useRef('')
  const shouldRestartRef = useRef(false)
  const manuallyStoppedRef = useRef(false)
  const speechLastRef = useRef(Date.now())
  const silenceIntervalRef = useRef<any>(null)
  const graceTimeoutRef = useRef<any>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)
  const meterStreamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<any>(null)
  const startedAtRef = useRef(0)
  const requestInFlightRef = useRef(false)

  // Mobile detection
  useEffect(() => {
    setIsMobile(window.innerWidth < 768)
    const saved = sessionStorage.getItem('voiceiq_ui_theme') as 'light' | 'dark' | null
    if (saved) setTheme(saved)
    const name = sessionStorage.getItem('voiceiq_student_name') ?? 'Student'
    const pId = sessionStorage.getItem('voiceiq_participant_id') ?? ''
    setStudentName(name)
    setParticipantId(pId)

    if (!initialized.current) {
      initialized.current = true
      void startMultimodalSession(name, pId)
    }
    return () => {
      stopMetering()
      recognitionRef.current?.stop()
      if (silenceIntervalRef.current) clearInterval(silenceIntervalRef.current)
      if (graceTimeoutRef.current) clearTimeout(graceTimeoutRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-flush event queue every 15s
  useEffect(() => {
    if (!currentTaskRunId) return
    const id = setInterval(() => void flushEvents(), 15_000)
    return () => clearInterval(id)
  }, [currentTaskRunId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Session start ─────────────────────────────────────────────────────────
  async function startMultimodalSession(name: string, pId: string) {
    if (!pId || !sessionId) { setError('Missing session info. Please re-enter from the lobby.'); return }
    try {
      setAiState('processing')
      const res = await fetch('/api/multimodal/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, participant_id: pId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data?.error ?? 'Failed to start session.')
        return
      }
      const data = await res.json()
      const taskRun = data.task_run as TaskRun | null

      if (data.action === 'finish_assessment') {
        await finalizeSession(pId)
        return
      }

      applyTaskRun(taskRun)
      setMaxTasks(data.decision?.sufficientEvidence ? Object.keys(data.decision.sufficientEvidence).length * 4 : 8)

      const examinerPrompt = data.examiner_prompt ?? 'Welcome. Let\'s begin your multimodal assessment.'
      addMessage('ai', examinerPrompt)
      setCurrentQuestion(examinerPrompt)
      setAiState('speaking')
      speakText(examinerPrompt, () => setAiState('idle'))

      await loadTypingPermission(pId)
    } catch (e) {
      setError('Could not connect to session. Please refresh.')
      setAiState('idle')
    }
  }

  function applyTaskRun(taskRun: TaskRun | null) {
    if (taskRun) {
      setCurrentTaskRun(taskRun)
      setCurrentTaskRunId(taskRun.id)
    }
  }

  async function loadTypingPermission(pId: string) {
    try {
      const res = await fetch(`/api/participants/${pId}/typing?session_id=${encodeURIComponent(sessionId)}`)
      if (res.ok) {
        const data = await res.json()
        setAllowTextInput(Boolean(data.allow_text_input))
      }
    } catch { /* non-fatal */ }
  }

  // ── Task submission ───────────────────────────────────────────────────────
  async function handleTaskSubmit(submission: TaskSubmission) {
    if (!currentTaskRunId || !participantId || requestInFlightRef.current) return
    requestInFlightRef.current = true
    setAiState('processing')

    queueEvent('task_submit_click', { task_run_id: currentTaskRunId })
    await flushEvents()

    try {
      const res = await fetch('/api/multimodal/task/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          participant_id: participantId,
          task_run_id: currentTaskRunId,
          submission_data: submission,
        }),
      })

      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()

      if (data.decision?.sufficientEvidence) {
        setEvidenceSufficient(data.decision.sufficientEvidence)
      }

      if (data.action === 'finish_assessment') {
        const msg = data.examiner_prompt ?? 'Excellent work! I now have enough evidence to complete your assessment.'
        addMessage('ai', msg)
        setCurrentQuestion(msg)
        setAiState('speaking')
        speakText(msg, async () => {
          setAiState('idle')
          await finalizeSession(participantId)
        })
        return
      }

      setTaskCompleted((prev) => prev + 1)
      const nextRun = data.next_task_run as TaskRun | null
      applyTaskRun(nextRun)

      const prompt = data.examiner_prompt ?? 'Good work! Here is your next task.'
      addMessage('ai', prompt)
      setCurrentQuestion(prompt)
      setAiState('speaking')
      speakText(prompt, () => setAiState('idle'))
    } catch {
      setError('Failed to submit task. Please try again.')
      setAiState('idle')
    } finally {
      requestInFlightRef.current = false
    }
  }

  // ── Voice follow-up ───────────────────────────────────────────────────────
  async function handleVoiceResponse(transcript: string) {
    if (!transcript.trim() || requestInFlightRef.current) return
    requestInFlightRef.current = true
    addMessage('student', transcript)
    setAiState('processing')

    try {
      const res = await fetch('/api/ai/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          participant_id: participantId,
          conversation_history: messages.map((m) => ({ role: m.role === 'ai' ? 'ai' : 'student', content: m.content })),
          student_name: studentName,
          question_number: taskCompleted + 1,
        }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()

      if (data.should_finish) { await finalizeSession(participantId); return }

      const nextQ = data.question ?? 'Please continue with the task on screen.'
      addMessage('ai', nextQ)
      setCurrentQuestion(nextQ)
      setAiState('speaking')
      speakText(nextQ, () => setAiState('idle'))
    } catch {
      setError('Connection issue. Please try again.')
      setAiState('idle')
    } finally {
      requestInFlightRef.current = false
    }
  }

  async function finalizeSession(pId: string) {
    try {
      await fetch('/api/multimodal/session/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, participant_id: pId }),
      })
    } catch { /* non-fatal */ }
    router.push(`/multimodal/results/${sessionId}`)
  }

  // ── Event queue ───────────────────────────────────────────────────────────
  function queueEvent(type: string, data: Record<string, unknown>) {
    taskEventQueueRef.current.push({ event_type: type, event_data: data, timestamp: new Date().toISOString() })
    if (taskEventQueueRef.current.length > 50) void flushEvents()
  }

  async function flushEvents() {
    if (!participantId || taskEventQueueRef.current.length === 0) return
    const batch = taskEventQueueRef.current.splice(0, taskEventQueueRef.current.length)
    try {
      await fetch('/api/multimodal/events/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, participant_id: participantId, task_run_id: currentTaskRunId, events: batch }),
      })
    } catch { /* non-fatal */ }
  }

  function addMessage(role: 'ai' | 'student', content: string) {
    setMessages((prev) => [...prev, { role, content, timestamp: new Date().toISOString() }])
  }

  // ── Voice recording ───────────────────────────────────────────────────────
  function stopMetering() {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null }
    if (audioCtxRef.current) { void audioCtxRef.current.close(); audioCtxRef.current = null }
    if (meterStreamRef.current) { meterStreamRef.current.getTracks().forEach((t) => t.stop()); meterStreamRef.current = null }
    analyserRef.current = null
    setWaveform(Array(WAVE_BARS).fill(0.08))
  }

  function startMetering(stream: MediaStream) {
    stopMetering()
    meterStreamRef.current = stream
    const ctx = new AudioContext()
    const src = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.8
    src.connect(analyser)
    audioCtxRef.current = ctx; analyserRef.current = analyser
    const freq = new Uint8Array(analyser.frequencyBinCount)
    const tick = (now: number) => {
      if (!analyserRef.current) return
      analyserRef.current.getByteFrequencyData(freq)
      const bucket = Math.max(1, Math.floor(freq.length / WAVE_BARS))
      const next = Array.from({ length: WAVE_BARS }, (_, i) => {
        let sum = 0; for (let j = 0; j < bucket; j++) sum += freq[i * bucket + j] ?? 0
        return Math.max(0.05, Math.min(1, (sum / (bucket * 255)) * 1.8))
      })
      setWaveform(next)
      animFrameRef.current = requestAnimationFrame(tick)
    }
    animFrameRef.current = requestAnimationFrame(tick)
  }

  async function startRecording() {
    const SpeechRec = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SpeechRec) { setError('Speech recognition not available in this browser.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      startMetering(stream)
    } catch { /* metering optional */ }

    finalSegmentsRef.current = []
    interimSegmentRef.current = ''
    manuallyStoppedRef.current = false
    shouldRestartRef.current = true
    speechLastRef.current = Date.now()
    startedAtRef.current = Date.now()
    setElapsedSeconds(0)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000)), 1000)

    const rec = new SpeechRec()
    rec.continuous = true; rec.interimResults = true; rec.lang = navigator.language || 'en-US'
    rec.onresult = (e: any) => {
      speechLastRef.current = Date.now()
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.trim()
        if (!t) continue
        if (e.results[i].isFinal) finalSegmentsRef.current.push(t)
        else interimSegmentRef.current = t
      }
    }
    rec.onerror = () => {}
    rec.onend = () => {
      if (shouldRestartRef.current && !manuallyStoppedRef.current) { try { rec.start() } catch { setIsRecording(false) }; return }
      setIsRecording(false); stopMetering()
      if (timerRef.current) clearInterval(timerRef.current)
    }
    recognitionRef.current = rec; rec.start(); setIsRecording(true)

    // Silence auto-submit
    if (silenceIntervalRef.current) clearInterval(silenceIntervalRef.current)
    silenceIntervalRef.current = setInterval(() => {
      const combined = [...finalSegmentsRef.current, interimSegmentRef.current].join(' ').trim()
      if (!combined) return
      if (Date.now() - speechLastRef.current >= AUTO_PAUSE_MS) {
        clearInterval(silenceIntervalRef.current)
        graceTimeoutRef.current = setTimeout(() => void submitVoice(), STITCH_GRACE_MS)
      }
    }, 300)
  }

  function stopRecording() {
    manuallyStoppedRef.current = true
    shouldRestartRef.current = false
    if (silenceIntervalRef.current) clearInterval(silenceIntervalRef.current)
    if (graceTimeoutRef.current) clearTimeout(graceTimeoutRef.current)
    recognitionRef.current?.stop()
    stopMetering()
    if (timerRef.current) clearInterval(timerRef.current)
    setIsRecording(false)
  }

  async function submitVoice() {
    const combined = [...finalSegmentsRef.current, interimSegmentRef.current].join(' ').trim()
    stopRecording()
    finalSegmentsRef.current = []; interimSegmentRef.current = ''
    if (!combined) return
    await handleVoiceResponse(combined)
  }

  // ── Evidence progress ─────────────────────────────────────────────────────
  const criteriaInSession = ['B', 'C'] // default; could be derived from assessment config
  const evidenceProgress: EvidenceProgress[] = criteriaInSession.map((c) => ({
    criterion: c,
    label: `Crit. ${c}`,
    collected: Object.entries(evidenceSufficient).filter(([k, v]) => k === c && v).length > 0 ? 3 : 0,
    required: 3,
    sufficient: evidenceSufficient[c] ?? false,
  }))

  // ── Mobile warning ────────────────────────────────────────────────────────
  if (isMobile && !mobileWarningDismissed) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <div className="max-w-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
            <AlertTriangle size={28} className="text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Best on larger screens</h1>
          <p className="text-sm text-gray-600">
            This multimodal assessment works best on a tablet or desktop. On a phone, some interactive tasks may be cramped.
          </p>
          <button
            onClick={() => setMobileWarningDismissed(true)}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-medium"
          >
            Continue anyway
          </button>
        </div>
      </div>
    )
  }

  // ── Error screen ──────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={`fixed inset-0 flex items-center justify-center px-6 ${dk ? 'bg-gray-950' : 'bg-gray-50'}`}>
        <div className="max-w-sm text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <span className="text-2xl">⚠</span>
          </div>
          <p className={`text-sm ${dk ? 'text-white/80' : 'text-gray-700'}`}>{error}</p>
          <button
            onClick={() => { setError(null); void startMultimodalSession(studentName, participantId) }}
            className="px-6 py-2.5 rounded-xl bg-blue-600 text-white font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  const taskConfig = currentTaskRun?.task_config ?? {}
  const taskType = (taskConfig.task_type_ui ?? taskConfig.task_type ?? 'short_answer') as CanonicalTaskType

  return (
    <div className={`fixed inset-0 flex flex-col overflow-hidden transition-colors ${dk ? 'bg-gray-950' : 'bg-gray-100'}`}>

      {/* Top header bar */}
      <div className={`flex-none h-12 px-5 flex items-center justify-between border-b ${dk ? 'border-white/10 bg-gray-900' : 'border-gray-200 bg-white'}`}>
        <span className={`text-xs font-bold tracking-widest uppercase ${dk ? 'text-white/40' : 'text-gray-400'}`}>VoiceIQ · Multimodal</span>
        <div className="flex items-center gap-3">
          <span className={`text-xs ${dk ? 'text-white/30' : 'text-gray-400'}`}>
            {studentName} · Task {(currentTaskRun?.task_sequence ?? 0)}/{maxTasks}
          </span>
          <button
            onClick={() => { const n = dk ? 'light' : 'dark'; setTheme(n as 'light' | 'dark'); sessionStorage.setItem('voiceiq_ui_theme', n) }}
            className={`p-1.5 rounded-full ${dk ? 'text-white/30 hover:text-white/60' : 'text-gray-400 hover:text-gray-700'}`}
          >
            {dk ? <Sun size={14} /> : <Moon size={14} />}
          </button>
        </div>
      </div>

      {/* Main 70/30 split */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* LEFT — Task Player (70%) */}
        <main className={`w-[70%] flex flex-col overflow-hidden border-r ${dk ? 'border-white/10' : 'border-gray-200'}`}>
          <div className="flex-1 overflow-y-auto p-6">
            <div className="max-w-2xl mx-auto">
              {currentTaskRun ? (
                <div className={`rounded-2xl p-6 shadow-sm ${dk ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200'}`}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                      currentTaskRun.criterion === 'B'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-green-100 text-green-700'
                    }`}>
                      Criterion {currentTaskRun.criterion}
                    </span>
                    {taskConfig.difficulty_level && (
                      <span className="text-[10px] text-gray-400">
                        Level {taskConfig.difficulty_level}
                      </span>
                    )}
                  </div>
                  <TaskPlayer
                    taskType={taskType}
                    title={taskConfig.title ?? 'Interactive Task'}
                    prompt={taskConfig.prompt ?? 'Complete this task and explain your reasoning.'}
                    config={taskConfig as Record<string, unknown>}
                    onSubmit={handleTaskSubmit}
                    onEvent={(type, data) => queueEvent(type, data)}
                    disabled={aiState !== 'idle'}
                  />
                </div>
              ) : aiState === 'processing' ? (
                <div className={`rounded-2xl p-6 shadow-sm ${dk ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200'}`}>
                  <TaskPlayer
                    taskType="short_answer"
                    title=""
                    prompt=""
                    onSubmit={() => {}}
                    loading={true}
                  />
                </div>
              ) : (
                <div className={`rounded-2xl p-12 text-center ${dk ? 'bg-gray-900 border border-white/10' : 'bg-white border border-gray-200'}`}>
                  <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                    <span className="text-xl">✓</span>
                  </div>
                  <p className={`text-base font-semibold ${dk ? 'text-white' : 'text-gray-800'}`}>All tasks complete</p>
                  <p className={`text-sm mt-1 ${dk ? 'text-white/60' : 'text-gray-500'}`}>Finalizing your assessment...</p>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* RIGHT — Examiner Panel (30%) */}
        <div className="w-[30%] flex flex-col min-w-[280px] max-w-[400px]">
          <ExaminerPanel
            aiState={aiState}
            messages={messages}
            currentQuestion={currentQuestion}
            taskProgress={{
              completed: taskCompleted,
              total: maxTasks,
              currentSequence: currentTaskRun?.task_sequence ?? 0,
            }}
            evidenceProgress={evidenceProgress}
            isRecording={isRecording}
            waveform={waveform}
            elapsed={elapsedSeconds}
            onStartRecording={() => void startRecording()}
            onStopRecording={stopRecording}
            onSubmitVoice={() => void submitVoice()}
            disabled={aiState !== 'idle'}
            allowTextInput={allowTextInput}
            onTextSubmit={(text) => void handleVoiceResponse(text)}
          />
        </div>
      </div>
    </div>
  )
}
