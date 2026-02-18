'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, ChevronRight, Mic, Moon, Sun } from 'lucide-react'

const THEME_KEY = 'voiceiq_ui_theme'

export default function BriefPage() {
  const { id: sessionId } = useParams<{ id: string }>()
  const router = useRouter()

  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [studentName, setStudentName] = useState('Student')
  const [assessmentTitle, setAssessmentTitle] = useState('Oral Assessment')
  const [assessmentTopic, setAssessmentTopic] = useState('')
  const [maxQuestions, setMaxQuestions] = useState(6)

  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [micStatus, setMicStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [micMessage, setMicMessage] = useState('')

  const dk = theme === 'dark'

  useEffect(() => {
    const saved = sessionStorage.getItem(THEME_KEY) as 'light' | 'dark' | null
    if (saved) setTheme(saved)

    setStudentName(sessionStorage.getItem('voiceiq_student_name') ?? 'Student')
    setAssessmentTitle(sessionStorage.getItem('voiceiq_assessment_title') ?? 'Oral Assessment')
    setAssessmentTopic(sessionStorage.getItem('voiceiq_assessment_topic') ?? '')
    setMaxQuestions(Number(sessionStorage.getItem('voiceiq_max_questions') ?? 6))

    void navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        const inputs = devices.filter((d) => d.kind === 'audioinput')
        setAudioInputs(inputs)
        if (inputs[0]?.deviceId) setSelectedDeviceId(inputs[0].deviceId)
      })
      .catch(() => {})
  }, [])

  function toggleTheme() {
    const next: 'light' | 'dark' = dk ? 'light' : 'dark'
    setTheme(next)
    sessionStorage.setItem(THEME_KEY, next)
  }

  async function testMic() {
    setMicStatus('checking')
    setMicMessage('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
      })
      stream.getTracks().forEach((t) => t.stop())
      const devices = await navigator.mediaDevices.enumerateDevices()
      setAudioInputs(devices.filter((d) => d.kind === 'audioinput'))
      setMicStatus('ok')
      setMicMessage('Microphone is working.')
    } catch {
      setMicStatus('error')
      setMicMessage('Microphone blocked. Please allow access in your browser settings and try again.')
    }
  }

  const estimatedMins = maxQuestions * 2

  // ── Derived class helpers ────────────────────────────────────────────────
  const surface = dk
    ? 'bg-white/5 border border-white/10'
    : 'bg-[#f4f4f5] border border-[#cdd2dd] shadow-sm'
  const sectionLabel = dk ? 'text-white/40' : 'text-[#223a83]'
  const bodyText = dk ? 'text-white/60' : 'text-[#3b5077]'
  const strongText = dk ? 'text-white/90' : 'text-[#1f3779]'
  const bullet = dk ? 'text-blue-400' : 'text-[#24408f]'

  return (
    <div
      className={`min-h-screen flex flex-col items-center justify-center px-4 py-10 transition-colors duration-300 ${
        dk ? 'bg-[#0d1117]' : 'bg-[#ece8c7]'
      }`}
    >
      <div className="w-full max-w-lg space-y-5">

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <p className={`text-xs font-semibold tracking-widest uppercase ${dk ? 'text-blue-400' : 'text-[#24408f]'}`}>
            VoiceIQ Assessment
          </p>
          <button
            onClick={toggleTheme}
            aria-label={dk ? 'Switch to light mode' : 'Switch to dark mode'}
            className={`p-2 rounded-full transition-colors ${
              dk
                ? 'text-white/40 hover:text-white/70 hover:bg-white/5'
                : 'text-[#60728f] hover:text-[#24408f] hover:bg-[#d9d3ad]'
            }`}
          >
            {dk ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        {/* Assessment title */}
        <div className="text-center">
          <h1 className={`text-2xl font-bold leading-tight ${dk ? 'text-white' : 'text-[#1f3779]'}`}>
            {assessmentTitle}
          </h1>
          {assessmentTopic && (
            <span
              className={`inline-block mt-2 px-3 py-1 text-sm rounded-full border ${
                dk
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-300'
                  : 'bg-[#ece6bf] border-[#c9be86] text-[#4a5a7a]'
              }`}
            >
              {assessmentTopic}
            </span>
          )}
        </div>

        {/* About */}
        <div className={`p-5 rounded-2xl ${surface}`}>
          <h2 className={`text-xs font-semibold mb-3 uppercase tracking-wider ${sectionLabel}`}>
            About this assessment
          </h2>
          <ul className={`space-y-2.5 text-sm ${bodyText}`}>
            {[
              <>An AI examiner will ask you up to <strong className={strongText}>{maxQuestions} questions</strong> verbally</>,
              <>Speak your answers clearly — your voice is converted to text automatically</>,
              <>Take your time to think before you speak — the AI will wait for you</>,
              <>Estimated time: approximately <strong className={strongText}>~{estimatedMins} minutes</strong></>,
              <>Your teacher will receive your results after you finish</>,
            ].map((item, i) => (
              <li key={i} className="flex gap-2.5">
                <span className={`mt-0.5 shrink-0 ${bullet}`}>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Mic setup */}
        <div className={`p-5 rounded-2xl ${surface}`}>
          <h2 className={`text-xs font-semibold mb-3 uppercase tracking-wider ${sectionLabel}`}>
            Microphone Setup
          </h2>

          {audioInputs.length > 1 && (
            <div className="mb-3">
              <label className={`block text-xs font-medium mb-1.5 ${dk ? 'text-white/40' : 'text-[#4a5a7a]'}`}>
                Input device
              </label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className={`w-full rounded-lg px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-[#24408f] ${
                  dk
                    ? 'bg-white/5 border-white/10 text-white/80'
                    : 'bg-[#ece6bf] border-[#4e5a75] text-[#1f3779]'
                }`}
              >
                {audioInputs.map((d, i) => (
                  <option key={d.deviceId || i} value={d.deviceId}>
                    {d.label || `Microphone ${i + 1}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            onClick={testMic}
            disabled={micStatus === 'checking'}
            className="bg-[#24408f] text-white hover:bg-[#1f387e] transition-colors rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 disabled:opacity-60"
          >
            <Mic size={14} />
            {micStatus === 'checking' ? 'Checking...' : 'Test Microphone'}
          </button>

          {micStatus === 'ok' && (
            <p className="mt-2.5 flex items-center gap-1.5 text-sm text-emerald-500">
              <CheckCircle2 size={15} /> {micMessage}
            </p>
          )}
          {micStatus === 'error' && (
            <p className="mt-2.5 flex items-start gap-1.5 text-sm text-amber-500">
              <AlertCircle size={15} className="mt-0.5 shrink-0" /> {micMessage}
            </p>
          )}
          {micStatus === 'idle' && (
            <p className={`mt-2 text-xs ${dk ? 'text-white/25' : 'text-[#7b8da8]'}`}>
              We recommend testing your microphone before starting.
            </p>
          )}
        </div>

        {/* CTA */}
        <div>
          <p className={`text-center text-sm mb-3 ${dk ? 'text-white/40' : 'text-[#516079]'}`}>
            Ready,{' '}
            <strong className={dk ? 'text-white/70' : 'text-[#1f3779]'}>{studentName}</strong>?
          </p>
          <button
            onClick={() => router.push(`/session/${sessionId}`)}
            className="w-full py-4 rounded-xl bg-[#24408f] text-white hover:bg-[#1f387e] transition-colors font-semibold text-lg flex items-center justify-center gap-2"
          >
            Begin Assessment
            <ChevronRight size={20} />
          </button>
        </div>

      </div>
    </div>
  )
}
