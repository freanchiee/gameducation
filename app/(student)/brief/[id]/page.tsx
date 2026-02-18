'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, ChevronRight, Mic } from 'lucide-react'

export default function BriefPage() {
  const { id: sessionId } = useParams<{ id: string }>()
  const router = useRouter()

  const [studentName, setStudentName] = useState('Student')
  const [assessmentTitle, setAssessmentTitle] = useState('Oral Assessment')
  const [assessmentTopic, setAssessmentTopic] = useState('')
  const [maxQuestions, setMaxQuestions] = useState(6)

  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')
  const [micStatus, setMicStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle')
  const [micMessage, setMicMessage] = useState('')

  useEffect(() => {
    setStudentName(sessionStorage.getItem('voiceiq_student_name') ?? 'Student')
    setAssessmentTitle(sessionStorage.getItem('voiceiq_assessment_title') ?? 'Oral Assessment')
    setAssessmentTopic(sessionStorage.getItem('voiceiq_assessment_topic') ?? '')
    setMaxQuestions(Number(sessionStorage.getItem('voiceiq_max_questions') ?? 6))

    void navigator.mediaDevices.enumerateDevices().then((devices) => {
      const inputs = devices.filter((d) => d.kind === 'audioinput')
      setAudioInputs(inputs)
      if (inputs[0]?.deviceId) setSelectedDeviceId(inputs[0].deviceId)
    }).catch(() => {})
  }, [])

  async function testMic() {
    setMicStatus('checking')
    setMicMessage('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
      })
      stream.getTracks().forEach((t) => t.stop())
      // Re-enumerate to get device labels after permission is granted
      const devices = await navigator.mediaDevices.enumerateDevices()
      const inputs = devices.filter((d) => d.kind === 'audioinput')
      setAudioInputs(inputs)
      setMicStatus('ok')
      setMicMessage('Microphone is working.')
    } catch {
      setMicStatus('error')
      setMicMessage('Microphone blocked. Please allow access in your browser settings and try again.')
    }
  }

  const estimatedMins = maxQuestions * 2

  return (
    <div className="min-h-screen bg-[#ece8c7] flex flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg space-y-5">

        {/* Header */}
        <div className="text-center mb-2">
          <p className="text-xs font-semibold text-[#24408f] tracking-widest uppercase mb-3">VoiceIQ Assessment</p>
          <h1 className="text-2xl font-bold text-[#1f3779] leading-tight">{assessmentTitle}</h1>
          {assessmentTopic && (
            <span className="inline-block mt-2 px-3 py-1 bg-[#ece6bf] border border-[#c9be86] text-[#4a5a7a] text-sm rounded-full">
              {assessmentTopic}
            </span>
          )}
        </div>

        {/* About this assessment */}
        <div className="gd-surface p-5">
          <h2 className="text-xs font-semibold text-[#223a83] mb-3 uppercase tracking-wider">About this assessment</h2>
          <ul className="space-y-2.5 text-sm text-[#3b5077]">
            <li className="flex gap-2.5">
              <span className="mt-0.5 text-[#24408f]">•</span>
              <span>An AI examiner will ask you up to <strong>{maxQuestions} questions</strong> verbally</span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 text-[#24408f]">•</span>
              <span>Speak your answers clearly — your voice is converted to text automatically</span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 text-[#24408f]">•</span>
              <span>Take your time to think before you speak — the AI will wait for you</span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 text-[#24408f]">•</span>
              <span>Estimated time: approximately <strong>{estimatedMins} minutes</strong></span>
            </li>
            <li className="flex gap-2.5">
              <span className="mt-0.5 text-[#24408f]">•</span>
              <span>Your teacher will receive your results after you finish</span>
            </li>
          </ul>
        </div>

        {/* Microphone setup */}
        <div className="gd-surface p-5">
          <h2 className="text-xs font-semibold text-[#223a83] mb-3 uppercase tracking-wider">Microphone Setup</h2>

          {audioInputs.length > 1 && (
            <div className="mb-3">
              <label className="block text-xs font-medium text-[#4a5a7a] mb-1.5">Input device</label>
              <select
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                className="gd-input w-full rounded-lg px-3 py-2 text-sm"
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
            className="gd-button rounded-lg px-4 py-2 text-sm font-medium flex items-center gap-2 disabled:opacity-60"
          >
            <Mic size={14} />
            {micStatus === 'checking' ? 'Checking...' : 'Test Microphone'}
          </button>

          {micStatus === 'ok' && (
            <p className="mt-2.5 flex items-center gap-1.5 text-sm text-emerald-700">
              <CheckCircle2 size={15} />
              {micMessage}
            </p>
          )}
          {micStatus === 'error' && (
            <p className="mt-2.5 flex items-start gap-1.5 text-sm text-amber-700">
              <AlertCircle size={15} className="mt-0.5 shrink-0" />
              {micMessage}
            </p>
          )}
          {micStatus === 'idle' && (
            <p className="mt-2 text-xs text-[#7b8da8]">
              We recommend testing your microphone before starting.
            </p>
          )}
        </div>

        {/* CTA */}
        <div>
          <p className="text-center text-sm text-[#516079] mb-3">
            Ready, <strong>{studentName}</strong>?
          </p>
          <button
            onClick={() => router.push(`/session/${sessionId}`)}
            className="w-full py-4 rounded-xl gd-button font-semibold text-lg flex items-center justify-center gap-2"
          >
            Begin Assessment
            <ChevronRight size={20} />
          </button>
        </div>

      </div>
    </div>
  )
}
