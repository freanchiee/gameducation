'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { Moon, Sun } from 'lucide-react'
import VoiceInterface from '@/components/assessment/VoiceInterface'
import type { Message } from '@/lib/types'

type AIState = 'idle' | 'listening' | 'processing' | 'speaking'
type AssessmentMode = 'voice' | 'multimodal'
type ConceptTracker = {
  target_concepts: string[]
  covered_concepts: string[]
  current_concept: string
}
type MediaDirective = {
  type: 'image' | 'video' | 'table' | 'simulation'
  material_id?: string
  url?: string
  start?: number
  end?: number
  context?: string
}
type TaskDirective = {
  type:
    | 'simulation_probe'
    | 'graph_analysis'
    | 'table_completion'
    | 'iv_dv_cv_sort'
    | 'matching'
    | 'fill_blank'
    | 'short_answer'
    | 'extended_response'
  title?: string
  prompt?: string
}
type RuntimeTaskRun = {
  id: string
  task_sequence: number
  status: string
  criterion: string
  task_config: {
    title?: string
    prompt?: string
    task_type_ui?: TaskDirective['type']
    simulation_url?: string | null
  }
}
type SessionMaterial = {
  id: string
  title: string
  type: string
  extracted_text: string | null
  material_data: Record<string, unknown>
  media_urls: string[]
  signed_url: string | null
}

const THEME_KEY = 'voiceiq_ui_theme'

function formatSeconds(s: number) {
  const m = Math.floor(s / 60)
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

function getYoutubeEmbedUrl(input: string) {
  try {
    const u = new URL(input)
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace('/', '')
      return id ? `https://www.youtube.com/embed/${id}` : input
    }
    if (u.hostname.includes('youtube.com')) {
      const id = u.searchParams.get('v')
      return id ? `https://www.youtube.com/embed/${id}` : input
    }
    return input
  } catch {
    return input
  }
}

function toNumeric(value: string) {
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function buildLinePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return ''
  return points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ')
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
  const [assessmentMode, setAssessmentMode] = useState<AssessmentMode>('voice')
  const [materialsById, setMaterialsById] = useState<Record<string, SessionMaterial>>({})
  const [materialsLoaded, setMaterialsLoaded] = useState(false)
  const [currentDirective, setCurrentDirective] = useState<MediaDirective | null>(null)
  const [currentTaskDirective, setCurrentTaskDirective] = useState<TaskDirective | null>(null)
  const [taskResponse, setTaskResponse] = useState('')
  const [taskSelections, setTaskSelections] = useState<Record<string, string>>({})
  const [taskNotes, setTaskNotes] = useState('')
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [screenshotPreviewUrl, setScreenshotPreviewUrl] = useState<string | null>(null)
  const [screenshotAttached, setScreenshotAttached] = useState(false)
  const [visionEvidenceUsed, setVisionEvidenceUsed] = useState(false)
  const [visionImagesUsed, setVisionImagesUsed] = useState(0)
  const [currentTaskRunId, setCurrentTaskRunId] = useState('')
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
  const taskEventQueueRef = useRef<Array<{ event_type: string; event_data: Record<string, unknown>; timestamp: string }>>([])
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

  useEffect(() => {
    if (!currentTaskRunId) return
    const timer = setInterval(() => {
      void flushTaskEvents()
    }, 10_000)
    return () => clearInterval(timer)
  }, [currentTaskRunId, participantId, sessionId]) // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => {
    return () => {
      if (screenshotPreviewUrl) {
        URL.revokeObjectURL(screenshotPreviewUrl)
      }
    }
  }, [screenshotPreviewUrl])

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

  async function loadSessionMaterials(pId: string) {
    if (!sessionId || !pId || materialsLoaded) return
    try {
      const res = await fetch(`/api/sessions/${sessionId}/materials?participant_id=${encodeURIComponent(pId)}`)
      if (!res.ok) return
      const data = await res.json()
      const next: Record<string, SessionMaterial> = {}
      for (const material of (data.materials ?? []) as SessionMaterial[]) {
        next[material.id] = material
      }
      setMaterialsById(next)
      setMaterialsLoaded(true)
      logDebug('materials loaded', { count: Object.keys(next).length })
    } catch {
      logDebug('materials load failed')
    }
  }

  function applyQuestionMetadata(
    mode: AssessmentMode,
    directives: MediaDirective[] | undefined,
    taskDirective: TaskDirective | undefined,
    pId: string
  ) {
    setAssessmentMode(mode)
    setCurrentDirective(directives && directives.length > 0 ? directives[0] : null)
    setCurrentTaskDirective(taskDirective ?? null)
    setTaskResponse('')
    setTaskSelections({})
    setTaskNotes('')
    setScreenshotFile(null)
    setScreenshotAttached(false)
    setVisionEvidenceUsed(false)
    setVisionImagesUsed(0)
    if (screenshotPreviewUrl) {
      URL.revokeObjectURL(screenshotPreviewUrl)
    }
    setScreenshotPreviewUrl(null)
    if (mode === 'multimodal') {
      void loadSessionMaterials(pId)
    }
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

  function queueTaskEvent(eventType: string, eventData: Record<string, unknown>) {
    if (!currentTaskRunId) return
    taskEventQueueRef.current.push({
      event_type: eventType,
      event_data: eventData,
      timestamp: new Date().toISOString(),
    })
    if (taskEventQueueRef.current.length > 40) {
      void flushTaskEvents()
    }
  }

  async function flushTaskEvents() {
    if (!currentTaskRunId || !participantId || taskEventQueueRef.current.length === 0) return
    const batch = taskEventQueueRef.current.splice(0, taskEventQueueRef.current.length)
    try {
      await fetch('/api/multimodal/task/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          participant_id: participantId,
          task_run_id: currentTaskRunId,
          events: batch,
        }),
      })
    } catch {
      // Keep the session resilient; failed event batch should not block assessment progress.
    }
  }

  async function bootstrapMultimodalRuntime(pId: string) {
    if (!pId || !sessionId) return
    try {
      const res = await fetch('/api/multimodal/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          participant_id: pId,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        logDebug('multimodal start failed', { status: res.status, error: data?.error })
        return
      }
      const data = await res.json()
      const taskRun = data.task_run as RuntimeTaskRun | null
      if (taskRun?.id) {
        setCurrentTaskRunId(taskRun.id)
      }
      if (data.task_widget?.type) {
        setCurrentTaskDirective({
          type: data.task_widget.type as TaskDirective['type'],
          title: data.task_widget.title,
          prompt: data.task_widget.prompt,
        })
      }
      if (data.media_directive) {
        setCurrentDirective(data.media_directive as MediaDirective)
      }
      logDebug('multimodal runtime started', {
        action: data.action,
        taskRunId: taskRun?.id ?? null,
      })
    } catch {
      logDebug('multimodal runtime start error')
    }
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
          await bootstrapMultimodalRuntime(pId)
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
      applyQuestionMetadata(
        (data.assessment_mode ?? 'voice') as AssessmentMode,
        data.media_directives as MediaDirective[] | undefined,
        data.task_directive as TaskDirective | undefined,
        pId
      )
      if ((data.assessment_mode ?? 'voice') === 'multimodal') {
        await bootstrapMultimodalRuntime(pId)
      }
      setVisionEvidenceUsed(Boolean(data.vision_evidence_used))
      setVisionImagesUsed(Number(data.vision_images_used ?? 0))
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
      applyQuestionMetadata(
        (data.assessment_mode ?? 'voice') as AssessmentMode,
        data.media_directives as MediaDirective[] | undefined,
        data.task_directive as TaskDirective | undefined,
        pId
      )
      if ((data.assessment_mode ?? 'voice') === 'multimodal' && !currentTaskRunId) {
        await bootstrapMultimodalRuntime(pId)
      }
      setVisionEvidenceUsed(Boolean(data.vision_evidence_used))
      setVisionImagesUsed(Number(data.vision_images_used ?? 0))
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
  const panelCard = dk ? 'border border-white/10 bg-white/5' : 'border border-gray-200 bg-white'
  const panelMuted = dk ? 'text-white/50' : 'text-gray-500'
  const panelHeading = dk ? 'text-white/85' : 'text-gray-900'
  const panelBg = dk ? 'bg-black/20' : 'bg-gray-50'

  const defaultSimulationMaterial = Object.values(materialsById).find((m) => {
    const kind = typeof m.material_data?.kind === 'string' ? m.material_data.kind : ''
    return kind === 'simulation' || /simulation|geogebra|phet/i.test(`${m.title} ${m.type}`)
  }) ?? null

  const effectiveDirective: MediaDirective | null = currentDirective ?? (defaultSimulationMaterial
    ? {
        type: 'simulation',
        material_id: defaultSimulationMaterial.id,
        url:
          (typeof defaultSimulationMaterial.material_data?.embed_url === 'string'
            ? defaultSimulationMaterial.material_data.embed_url
            : typeof defaultSimulationMaterial.material_data?.url === 'string'
            ? defaultSimulationMaterial.material_data.url
            : ''),
        context: 'Explore the simulation and use the data/task panel to support your answer.',
      }
    : null)

  const activeMaterial = effectiveDirective?.material_id ? materialsById[effectiveDirective.material_id] : null
  const fallbackUrl =
    activeMaterial?.signed_url ||
    effectiveDirective?.url ||
    activeMaterial?.media_urls?.[0] ||
    ((activeMaterial?.material_data?.url as string | undefined) ?? null)
  const viewerTitle = activeMaterial?.title ?? 'Session material'
  const viewerContext = effectiveDirective?.context ?? ''

  async function submitTaskWorkspaceAnswer() {
    if (aiState !== 'idle') return
    queueTaskEvent('task_submit_click', { task_run_id: currentTaskRunId || null })
    await flushTaskEvents()

    let screenshotRef = ''
    if (screenshotFile && participantId) {
      try {
        const fd = new FormData()
        fd.append('participant_id', participantId)
        fd.append('file', screenshotFile)
        const res = await fetch(`/api/sessions/${sessionId}/artifacts`, {
          method: 'POST',
          body: fd,
        })
        if (res.ok) {
          const data = await res.json()
          screenshotRef = data.signed_url ?? ''
          setScreenshotAttached(true)
        }
      } catch {
        screenshotRef = ''
        setScreenshotAttached(false)
      }
    }

    const nonEmptySelections = Object.values(taskSelections).filter((v) => String(v).trim().length > 0).length
    const possibleSelectionCount = Math.max(Object.keys(taskSelections).length, 1)
    const completeness = Math.max(
      0,
      Math.min(
        1,
        nonEmptySelections / possibleSelectionCount +
          (taskResponse.trim() ? 0.25 : 0) +
          (taskNotes.trim() ? 0.1 : 0) +
          (screenshotRef ? 0.1 : 0)
      )
    )

    let runtimeExaminerPrompt = ''
    if (assessmentMode === 'multimodal' && currentTaskRunId && participantId) {
      try {
        const submitRes = await fetch('/api/multimodal/task/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            participant_id: participantId,
            task_run_id: currentTaskRunId,
            submission_data: {
              correctness: Number(completeness.toFixed(3)),
              time_spent_seconds: totalElapsed,
              task_response: taskResponse,
              task_notes: taskNotes,
              task_selections: taskSelections,
              screenshot_url: screenshotRef || null,
            },
          }),
        })

        if (submitRes.ok) {
          const data = await submitRes.json()
          runtimeExaminerPrompt = String(data.examiner_prompt ?? '')
          const nextRun = data.next_task_run as RuntimeTaskRun | undefined
          if (nextRun?.id) {
            setCurrentTaskRunId(nextRun.id)
            if (data.task_widget?.type) {
              setCurrentTaskDirective({
                type: data.task_widget.type as TaskDirective['type'],
                title: data.task_widget.title,
                prompt: data.task_widget.prompt,
              })
            }
            if (data.media_directive) {
              setCurrentDirective(data.media_directive as MediaDirective)
            }
          }
        }
      } catch {
        logDebug('multimodal task submit failed')
      }
    }

    const parts = [
      currentTaskDirective?.title ? `Task: ${currentTaskDirective.title}` : 'Task response',
      currentTaskDirective?.prompt ? `Prompt: ${currentTaskDirective.prompt}` : '',
      taskResponse ? `Student response: ${taskResponse}` : '',
      taskNotes ? `Workspace notes: ${taskNotes}` : '',
      screenshotFile ? `Screenshot attached: ${screenshotFile.name}` : '',
      screenshotRef ? `Screenshot URL: ${screenshotRef}` : '',
      Object.keys(taskSelections).length > 0
        ? `Structured entries: ${Object.entries(taskSelections).map(([k, v]) => `${k}=${v}`).join(', ')}`
        : '',
      runtimeExaminerPrompt ? `Orchestrator follow-up: ${runtimeExaminerPrompt}` : '',
    ].filter(Boolean)
    const merged = parts.join('\n')
    if (!merged.trim()) return
    void handleStudentResponse(merged)
  }

  function updateTaskSelection(key: string, value: string) {
    setTaskSelections((prev) => ({ ...prev, [key]: value }))
    queueTaskEvent('task_input', { key, value })
  }

  function renderGraphPreview() {
    const rows = [1, 2, 3, 4, 5]
      .map((row) => ({
        x: toNumeric(taskSelections[`${row}-Input`] ?? ''),
        y: toNumeric(taskSelections[`${row}-Output`] ?? ''),
      }))
      .filter((p): p is { x: number; y: number } => p.x !== null && p.y !== null)
      .sort((a, b) => a.x - b.x)

    if (rows.length < 2) {
      return <p className={`text-[11px] ${panelMuted}`}>Enter at least 2 numeric Input/Output pairs to preview the graph.</p>
    }

    const xMin = Math.min(...rows.map((p) => p.x))
    const xMax = Math.max(...rows.map((p) => p.x))
    const yMin = Math.min(...rows.map((p) => p.y))
    const yMax = Math.max(...rows.map((p) => p.y))
    const w = 280
    const h = 150
    const pad = 20
    const xSpan = Math.max(xMax - xMin, 1)
    const ySpan = Math.max(yMax - yMin, 1)

    const points = rows.map((p) => ({
      x: pad + ((p.x - xMin) / xSpan) * (w - pad * 2),
      y: h - pad - ((p.y - yMin) / ySpan) * (h - pad * 2),
    }))

    const path = buildLinePath(points)

    return (
      <div className="rounded-lg border border-black/10 bg-black/5 p-2">
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-[150px]">
          <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="currentColor" className={dk ? 'text-white/35' : 'text-gray-500'} />
          <line x1={pad} y1={pad} x2={pad} y2={h - pad} stroke="currentColor" className={dk ? 'text-white/35' : 'text-gray-500'} />
          <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2" />
          {points.map((p, idx) => (
            <circle key={idx} cx={p.x} cy={p.y} r="3" fill="#1d4ed8" />
          ))}
        </svg>
      </div>
    )
  }

  function renderTaskWorkspace() {
    if (!currentTaskDirective) return null

    const title = currentTaskDirective.title || 'Interactive task'
    const prompt = currentTaskDirective.prompt || 'Use the media and provide your evidence-based answer.'

    if (currentTaskDirective.type === 'iv_dv_cv_sort') {
      return (
        <div className={`rounded-xl border border-black/10 p-3 space-y-3 ${panelBg}`}>
          <p className={`text-xs font-semibold ${panelHeading}`}>{title}</p>
          <p className={`text-xs ${panelMuted}`}>{prompt}</p>
          <div className="grid grid-cols-1 gap-2">
            {['Variable A', 'Variable B', 'Variable C'].map((v) => (
              <div key={v} className="grid grid-cols-[1fr_120px] gap-2">
                <input
                  value={taskSelections[`${v}-name`] ?? ''}
                  onChange={(e) => updateTaskSelection(`${v}-name`, e.target.value)}
                  placeholder={`${v} name`}
                  className="px-2 py-1.5 text-xs rounded border border-gray-300 bg-white/90 text-gray-800"
                />
                <select
                  value={taskSelections[`${v}-role`] ?? ''}
                  onChange={(e) => updateTaskSelection(`${v}-role`, e.target.value)}
                  className="px-2 py-1.5 text-xs rounded border border-gray-300 bg-white/90 text-gray-800"
                >
                  <option value="">Type</option>
                  <option value="IV">IV</option>
                  <option value="DV">DV</option>
                  <option value="CV">CV</option>
                </select>
              </div>
            ))}
          </div>
        </div>
      )
    }

    if (currentTaskDirective.type === 'table_completion') {
      return (
        <div className={`rounded-xl border border-black/10 p-3 space-y-3 ${panelBg}`}>
          <p className={`text-xs font-semibold ${panelHeading}`}>{title}</p>
          <p className={`text-xs ${panelMuted}`}>{prompt}</p>
          <div className="grid gap-2">
            {[1, 2, 3, 4, 5].map((row) => (
              <div key={row} className="grid grid-cols-3 gap-2">
                {['Input', 'Output', 'Note'].map((col) => (
                  <input
                    key={`${row}-${col}`}
                    value={taskSelections[`${row}-${col}`] ?? ''}
                    onChange={(e) => updateTaskSelection(`${row}-${col}`, e.target.value)}
                    placeholder={`${col} ${row}`}
                    className="px-2 py-1.5 text-xs rounded border border-gray-300 bg-white/90 text-gray-800"
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <p className={`text-[11px] font-medium ${panelMuted}`}>Auto graph preview (Input vs Output)</p>
            {renderGraphPreview()}
          </div>
        </div>
      )
    }

    if (currentTaskDirective.type === 'matching') {
      return (
        <div className={`rounded-xl border border-black/10 p-3 space-y-3 ${panelBg}`}>
          <p className={`text-xs font-semibold ${panelHeading}`}>{title}</p>
          <p className={`text-xs ${panelMuted}`}>{prompt}</p>
          <div className="grid gap-2">
            {['A', 'B', 'C'].map((left) => (
              <div key={left} className="grid grid-cols-[1fr_1fr] gap-2">
                <input
                  value={taskSelections[`left-${left}`] ?? ''}
                  onChange={(e) => updateTaskSelection(`left-${left}`, e.target.value)}
                  placeholder={`Item ${left}`}
                  className="px-2 py-1.5 text-xs rounded border border-gray-300 bg-white/90 text-gray-800"
                />
                <input
                  value={taskSelections[`right-${left}`] ?? ''}
                  onChange={(e) => updateTaskSelection(`right-${left}`, e.target.value)}
                  placeholder={`Match for ${left}`}
                  className="px-2 py-1.5 text-xs rounded border border-gray-300 bg-white/90 text-gray-800"
                />
              </div>
            ))}
          </div>
        </div>
      )
    }

    return (
      <div className={`rounded-xl border border-black/10 p-3 space-y-2 ${panelBg}`}>
        <p className={`text-xs font-semibold ${panelHeading}`}>{title}</p>
        <p className={`text-xs ${panelMuted}`}>{prompt}</p>
      </div>
    )
  }

  function renderMediaContent() {
    if (!effectiveDirective) {
      return (
        <div className={`rounded-xl p-4 text-sm ${panelBg} ${panelMuted}`}>
          The AI will surface visuals here when needed.
        </div>
      )
    }

    if (!activeMaterial && !effectiveDirective.url) {
      return (
        <div className={`rounded-xl p-4 text-sm ${panelBg} ${panelMuted}`}>
          Could not resolve media item <span className="font-mono">{effectiveDirective.material_id ?? 'unknown'}</span>.
        </div>
      )
    }

    if (effectiveDirective.type === 'image') {
      if (!fallbackUrl) {
        return <div className={`rounded-xl p-4 text-sm ${panelBg} ${panelMuted}`}>Image source not available.</div>
      }
      return <img src={fallbackUrl} alt={viewerTitle} className="w-full rounded-xl border border-black/10 object-contain max-h-[320px]" />
    }

    if (effectiveDirective.type === 'video') {
      if (!fallbackUrl) {
        return <div className={`rounded-xl p-4 text-sm ${panelBg} ${panelMuted}`}>Video source not available.</div>
      }
      const isYoutube = /youtu\.be|youtube\.com/i.test(fallbackUrl)
      const embedUrl = getYoutubeEmbedUrl(fallbackUrl)
      return (
        <div className="space-y-2">
          <div className="aspect-video w-full overflow-hidden rounded-xl border border-black/10">
            {isYoutube ? (
              <iframe
                src={embedUrl}
                title={viewerTitle}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <video src={fallbackUrl} controls className="w-full h-full object-cover" />
            )}
          </div>
          {(typeof effectiveDirective.start === 'number' || typeof effectiveDirective.end === 'number') && (
            <p className={`text-xs ${panelMuted}`}>
              Clip focus: {effectiveDirective.start ?? 0}s to {effectiveDirective.end ?? 'end'}s
            </p>
          )}
        </div>
      )
    }

    if (effectiveDirective.type === 'simulation') {
      if (!fallbackUrl) {
        return <div className={`rounded-xl p-4 text-sm ${panelBg} ${panelMuted}`}>Simulation URL not available.</div>
      }
      return (
        <div className="space-y-2">
          <div className="aspect-video w-full overflow-hidden rounded-xl border border-black/10">
            <iframe src={fallbackUrl} title={viewerTitle} className="w-full h-full" />
          </div>
          <a href={fallbackUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-500 hover:text-blue-400">
            Open simulation in new tab
          </a>
        </div>
      )
    }

    return (
      <div className={`rounded-xl border border-black/10 p-4 text-sm leading-relaxed max-h-[320px] overflow-auto ${panelBg} ${dk ? 'text-white/80' : 'text-gray-700'}`}>
        {activeMaterial?.extracted_text?.trim() || 'No table/text content available for this step.'}
      </div>
    )
  }

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
      <div className="flex-1 min-h-0 px-4 lg:px-6 pt-5 pb-3">
        <div className="h-full w-full max-w-[1280px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-5">
          <div className="flex flex-col items-center justify-center gap-6 min-h-0">
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

          {assessmentMode === 'multimodal' && (
            <aside className={`rounded-2xl p-4 lg:p-5 ${panelCard} flex flex-col gap-3 overflow-hidden`}>
              <div>
                <p className={`text-[10px] font-semibold uppercase tracking-widest mb-1 ${captionLabel}`}>Media Viewer</p>
                <h3 className={`text-sm font-semibold ${panelHeading}`}>{viewerTitle}</h3>
                {viewerContext && <p className={`text-xs mt-1 ${panelMuted}`}>{viewerContext}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {screenshotAttached && (
                    <span className="inline-flex items-center rounded-full border border-emerald-300/50 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500">
                      Screenshot attached
                    </span>
                  )}
                  {visionEvidenceUsed && (
                    <span className="inline-flex items-center rounded-full border border-blue-300/50 bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-500">
                      Vision evidence analyzed{visionImagesUsed > 0 ? ` (${visionImagesUsed})` : ''}
                    </span>
                  )}
                </div>
              </div>
              {renderTaskWorkspace()}
              {renderMediaContent()}
              {currentTaskDirective && (
                <div className="space-y-2">
                  <textarea
                    value={taskNotes}
                    onChange={(e) => {
                      setTaskNotes(e.target.value)
                      queueTaskEvent('task_notes', { value: e.target.value })
                    }}
                    rows={2}
                    placeholder="Notes: observations, variable behavior, trend summary..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white/90 text-gray-800 text-xs resize-none"
                  />
                  <textarea
                    value={taskResponse}
                    onChange={(e) => {
                      setTaskResponse(e.target.value)
                      queueTaskEvent('task_response_draft', { value: e.target.value })
                    }}
                    rows={3}
                    placeholder="Write your observation from the simulation/graph/task..."
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 bg-white/90 text-gray-800 text-xs resize-none"
                  />
                  <div className="space-y-1">
                    <label className={`block text-[11px] ${panelMuted}`}>Attach screenshot evidence (optional)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const f = e.target.files?.[0] ?? null
                        setScreenshotFile(f)
                        queueTaskEvent('task_file_select', { file_name: f?.name ?? null })
                        if (screenshotPreviewUrl) {
                          URL.revokeObjectURL(screenshotPreviewUrl)
                        }
                        setScreenshotPreviewUrl(f ? URL.createObjectURL(f) : null)
                      }}
                      className="w-full text-[11px]"
                    />
                    {screenshotPreviewUrl && (
                      <img src={screenshotPreviewUrl} alt="Task screenshot preview" className="w-full max-h-24 object-cover rounded border border-black/10" />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={submitTaskWorkspaceAnswer}
                    className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                  >
                    Submit task response to examiner
                  </button>
                </div>
              )}
            </aside>
          )}
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
