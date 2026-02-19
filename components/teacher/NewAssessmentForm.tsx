'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Class, AssessmentCriterion, AssessmentMode } from '@/lib/types'
import { FilePlus2, Trash2, Youtube, Globe, FileText, Image as ImageIcon, Video } from 'lucide-react'

const SUBJECT_TOPICS: Record<string, Record<string, string[]>> = {
  Physics: {
    'MYP 3': ['Energy', 'Light'],
    'MYP 4': ['Waves', 'Electricity', 'Forces & Motion', 'Thermal Physics'],
    'MYP 5': ['Atomic Physics', 'Electromagnetism'],
    'DP Year 1': ['Mechanics', 'Thermal Physics', 'Waves', 'Electricity & Magnetism'],
    'DP Year 2': ['Atomic & Nuclear Physics', 'Energy Production', 'Fields'],
  },
  Chemistry: {
    'MYP 3': ['Atoms & Elements', 'Chemical Reactions'],
    'MYP 4': ['Bonding', 'Stoichiometry', 'Acids & Bases'],
    'MYP 5': ['Organic Chemistry', 'Electrochemistry'],
  },
  Biology: {
    'MYP 3': ['Cell Biology', 'Ecology'],
    'MYP 4': ['Genetics', 'Human Physiology'],
    'MYP 5': ['Evolution', 'Microbiology'],
  },
}

const CRITERIA: { value: AssessmentCriterion; label: string }[] = [
  { value: 'A', label: 'A – Knowing & Understanding' },
  { value: 'B', label: 'B – Inquiring & Designing' },
  { value: 'C', label: 'C – Processing & Evaluating' },
  { value: 'D', label: 'D – Reflecting on Impacts' },
]

function generateAccessCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function inferMaterialType(fileName: string) {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return 'pdf'
  if (ext === 'docx') return 'docx'
  if (ext === 'pptx') return 'pptx'
  if (ext === 'mp4' || ext === 'mov' || ext === 'webm' || ext === 'mp3' || ext === 'wav') return 'video'
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'gif' || ext === 'webp') return 'image'
  return 'pdf'
}

interface Props {
  classes: Class[]
  initialServerDraftId?: string
}

type RawTextItem = { id: string; title: string; content: string }
type MultimodalDraft = {
  mode: AssessmentMode
  classId: string
  title: string
  description: string
  topic: string
  criteria: AssessmentCriterion[]
  maxQuestions: number
  topicContext: string
  customInstructions: string
  tabLockEnabled: boolean
  proctoringEnabled: boolean
  youtubeUrls: string[]
  websiteUrls: string[]
  rawTexts: RawTextItem[]
  savedAt: string
}

const MULTIMODAL_DRAFT_KEY = 'voiceiq.multimodal.draft.v1'

type ServerDraftRow = {
  id: string
  title: string | null
  topic: string | null
  mode: AssessmentMode
  payload: MultimodalDraft
  updated_at: string
}

export default function NewAssessmentForm({ classes, initialServerDraftId }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const firstClass = classes[0]

  const [mode, setMode] = useState<AssessmentMode>('voice')
  const [classId, setClassId] = useState(firstClass?.id ?? '')
  const [selectedClass, setSelectedClass] = useState<Class | undefined>(firstClass)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [topic, setTopic] = useState(() => {
    if (!firstClass) return ''
    const topics = SUBJECT_TOPICS[firstClass.subject]?.[firstClass.year_group]
    return topics?.[0] ?? ''
  })
  const [criteria, setCriteria] = useState<AssessmentCriterion[]>(['A'])
  const [maxQuestions, setMaxQuestions] = useState(6)
  const [topicContext, setTopicContext] = useState('')
  const [customInstructions, setCustomInstructions] = useState('')
  const [tabLockEnabled, setTabLockEnabled] = useState(false)
  const [proctoringEnabled, setProctoringEnabled] = useState(false)

  const [files, setFiles] = useState<File[]>([])
  const [youtubeInput, setYoutubeInput] = useState('')
  const [websiteInput, setWebsiteInput] = useState('')
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>([])
  const [websiteUrls, setWebsiteUrls] = useState<string[]>([])
  const [rawTextTitle, setRawTextTitle] = useState('')
  const [rawTextContent, setRawTextContent] = useState('')
  const [rawTexts, setRawTexts] = useState<RawTextItem[]>([])

  const [loading, setLoading] = useState(false)
  const [autoPopulateLoading, setAutoPopulateLoading] = useState(false)
  const [serverDraftLoading, setServerDraftLoading] = useState(false)
  const [serverDrafts, setServerDrafts] = useState<ServerDraftRow[]>([])
  const [selectedServerDraftId, setSelectedServerDraftId] = useState('')
  const [activeServerDraftId, setActiveServerDraftId] = useState<string | null>(initialServerDraftId ?? null)
  const [saveDraftMessage, setSaveDraftMessage] = useState('')
  const [draftExists, setDraftExists] = useState(false)
  const [autoPopulateError, setAutoPopulateError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasAutoPopulatedOnce, setHasAutoPopulatedOnce] = useState(false)

  function handleClassChange(id: string) {
    setClassId(id)
    const cls = classes.find((c) => c.id === id)
    setSelectedClass(cls)
    if (cls) {
      const topics = SUBJECT_TOPICS[cls.subject]?.[cls.year_group]
      setTopic(topics?.[0] ?? '')
    }
  }

  function toggleCriterion(c: AssessmentCriterion) {
    setCriteria((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    )
  }

  const availableTopics = selectedClass
    ? (SUBJECT_TOPICS[selectedClass.subject]?.[selectedClass.year_group] ?? [])
    : []

  const materialCount = useMemo(
    () => files.length + youtubeUrls.length + websiteUrls.length + rawTexts.length,
    [files.length, youtubeUrls.length, websiteUrls.length, rawTexts.length]
  )

  function pushYouTube() {
    const v = youtubeInput.trim()
    if (!v) return
    setYoutubeUrls((prev) => [...prev, v])
    setYoutubeInput('')
  }

  function pushWebsite() {
    const v = websiteInput.trim()
    if (!v) return
    setWebsiteUrls((prev) => [...prev, v])
    setWebsiteInput('')
  }

  function pushRawText() {
    const content = rawTextContent.trim()
    if (!content) return
    setRawTexts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        title: rawTextTitle.trim() || `Notes ${prev.length + 1}`,
        content,
      },
    ])
    setRawTextTitle('')
    setRawTextContent('')
  }

  function collectDraftPayload(): MultimodalDraft {
    return {
      mode,
      classId,
      title,
      description,
      topic,
      criteria,
      maxQuestions,
      topicContext,
      customInstructions,
      tabLockEnabled,
      proctoringEnabled,
      youtubeUrls,
      websiteUrls,
      rawTexts,
      savedAt: new Date().toISOString(),
    }
  }

  function saveDraftToLocalStorage(showToast = false) {
    if (typeof window === 'undefined') return
    const payload = collectDraftPayload()
    window.localStorage.setItem(MULTIMODAL_DRAFT_KEY, JSON.stringify(payload))
    setDraftExists(true)
    if (showToast) {
      setSaveDraftMessage(`Draft saved at ${new Date().toLocaleTimeString()}`)
      window.setTimeout(() => setSaveDraftMessage(''), 2500)
    }
  }

  function loadDraftFromLocalStorage(showToast = false) {
    if (typeof window === 'undefined') return
    const raw = window.localStorage.getItem(MULTIMODAL_DRAFT_KEY)
    if (!raw) return
    try {
      const draft = JSON.parse(raw) as MultimodalDraft
      setMode(draft.mode ?? 'multimodal')
      setClassId(draft.classId ?? classId)
      const cls = classes.find((c) => c.id === draft.classId)
      if (cls) setSelectedClass(cls)
      setTitle(draft.title ?? '')
      setDescription(draft.description ?? '')
      setTopic(draft.topic ?? '')
      setCriteria(Array.isArray(draft.criteria) && draft.criteria.length > 0 ? draft.criteria : ['A'])
      setMaxQuestions(typeof draft.maxQuestions === 'number' ? draft.maxQuestions : 6)
      setTopicContext(draft.topicContext ?? '')
      setCustomInstructions(draft.customInstructions ?? '')
      setTabLockEnabled(Boolean(draft.tabLockEnabled))
      setProctoringEnabled(Boolean(draft.proctoringEnabled))
      setYoutubeUrls(Array.isArray(draft.youtubeUrls) ? draft.youtubeUrls : [])
      setWebsiteUrls(Array.isArray(draft.websiteUrls) ? draft.websiteUrls : [])
      setRawTexts(Array.isArray(draft.rawTexts) ? draft.rawTexts : [])
      if (showToast) {
        setSaveDraftMessage(`Draft loaded (${new Date(draft.savedAt).toLocaleString()})`)
        window.setTimeout(() => setSaveDraftMessage(''), 3000)
      }
      setDraftExists(true)
    } catch {
      setSaveDraftMessage('Draft could not be loaded (invalid format).')
      window.setTimeout(() => setSaveDraftMessage(''), 3000)
    }
  }

  function clearDraftFromLocalStorage() {
    if (typeof window === 'undefined') return
    window.localStorage.removeItem(MULTIMODAL_DRAFT_KEY)
    setDraftExists(false)
    setSaveDraftMessage('Saved draft cleared.')
    window.setTimeout(() => setSaveDraftMessage(''), 2500)
  }

  function applyDraft(draft: MultimodalDraft) {
    setMode(draft.mode ?? 'multimodal')
    setClassId(draft.classId ?? classId)
    const cls = classes.find((c) => c.id === draft.classId)
    if (cls) setSelectedClass(cls)
    setTitle(draft.title ?? '')
    setDescription(draft.description ?? '')
    setTopic(draft.topic ?? '')
    setCriteria(Array.isArray(draft.criteria) && draft.criteria.length > 0 ? draft.criteria : ['A'])
    setMaxQuestions(typeof draft.maxQuestions === 'number' ? draft.maxQuestions : 6)
    setTopicContext(draft.topicContext ?? '')
    setCustomInstructions(draft.customInstructions ?? '')
    setTabLockEnabled(Boolean(draft.tabLockEnabled))
    setProctoringEnabled(Boolean(draft.proctoringEnabled))
    setYoutubeUrls(Array.isArray(draft.youtubeUrls) ? draft.youtubeUrls : [])
    setWebsiteUrls(Array.isArray(draft.websiteUrls) ? draft.websiteUrls : [])
    setRawTexts(Array.isArray(draft.rawTexts) ? draft.rawTexts : [])
  }

  async function fetchServerDrafts() {
    setServerDraftLoading(true)
    const { data, error: fetchError } = await supabase
      .from('assessment_drafts')
      .select('id, title, topic, mode, payload, updated_at')
      .order('updated_at', { ascending: false })
      .limit(30)

    if (fetchError) {
      if ((fetchError as any)?.message?.includes('assessment_drafts')) {
        setSaveDraftMessage('Server drafts unavailable. Run migration 004_assessment_drafts.sql.')
        window.setTimeout(() => setSaveDraftMessage(''), 3000)
      }
      setServerDraftLoading(false)
      return
    }

    const rows = (data ?? []) as ServerDraftRow[]
    setServerDrafts(rows)
    if (initialServerDraftId) {
      const target = rows.find((d) => d.id === initialServerDraftId)
      if (target) {
        setSelectedServerDraftId(target.id)
        setActiveServerDraftId(target.id)
        applyDraft(target.payload)
      }
    }
    setServerDraftLoading(false)
  }

  async function saveDraftToServer() {
    setServerDraftLoading(true)
    setError(null)
    const payload = collectDraftPayload()

    if (activeServerDraftId) {
      const { error: updateError } = await supabase
        .from('assessment_drafts')
        .update({
          class_id: classId || null,
          title: title || null,
          topic: topic || null,
          mode,
          payload,
          updated_at: new Date().toISOString(),
        })
        .eq('id', activeServerDraftId)

      if (updateError) {
        setError(updateError.message)
        setServerDraftLoading(false)
        return
      }
      setSaveDraftMessage('Draft saved to server.')
      window.setTimeout(() => setSaveDraftMessage(''), 2500)
    } else {
      const { data, error: insertError } = await supabase
        .from('assessment_drafts')
        .insert({
          class_id: classId || null,
          title: title || null,
          topic: topic || null,
          mode,
          payload,
        })
        .select('id')
        .single()

      if (insertError || !data) {
        setError(insertError?.message ?? 'Failed to save server draft.')
        setServerDraftLoading(false)
        return
      }
      setActiveServerDraftId(data.id)
      setSelectedServerDraftId(data.id)
      setSaveDraftMessage('Draft saved to server.')
      window.setTimeout(() => setSaveDraftMessage(''), 2500)
    }

    await fetchServerDrafts()
    setServerDraftLoading(false)
  }

  function loadSelectedServerDraft() {
    const row = serverDrafts.find((d) => d.id === selectedServerDraftId)
    if (!row) return
    applyDraft(row.payload)
    setActiveServerDraftId(row.id)
    setSaveDraftMessage(`Loaded server draft from ${new Date(row.updated_at).toLocaleString()}`)
    window.setTimeout(() => setSaveDraftMessage(''), 3000)
  }

  async function autoPopulateResources() {
    if (!selectedClass || !topic || autoPopulateLoading) return
    setAutoPopulateLoading(true)
    setAutoPopulateError(null)
    try {
      const res = await fetch('/api/resources/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          subject: selectedClass.subject,
          year_group: selectedClass.year_group,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Could not fetch suggested resources')
      }

      const data = await res.json()
      if (youtubeUrls.length === 0 && data.youtube_url) {
        setYoutubeUrls([data.youtube_url])
      }
      if (websiteUrls.length === 0 && data.website_url) {
        setWebsiteUrls([data.website_url])
      }
      if (rawTexts.length === 0 && data.raw_text) {
        setRawTexts([
          {
            id: crypto.randomUUID(),
            title: data.raw_text_title || `${topic} quick notes`,
            content: data.raw_text,
          },
        ])
      }
      setHasAutoPopulatedOnce(true)
    } catch (err) {
      setAutoPopulateError(err instanceof Error ? err.message : 'Could not auto-populate resources')
    } finally {
      setAutoPopulateLoading(false)
    }
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(MULTIMODAL_DRAFT_KEY)
    if (!saved) return
    setDraftExists(true)
    if (!title && !description && !topicContext && youtubeUrls.length === 0 && websiteUrls.length === 0 && rawTexts.length === 0) {
      loadDraftFromLocalStorage(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mode !== 'multimodal') return
    saveDraftToLocalStorage(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mode, classId, title, description, topic, criteria, maxQuestions, topicContext, customInstructions,
    tabLockEnabled, proctoringEnabled, youtubeUrls, websiteUrls, rawTexts
  ])

  useEffect(() => {
    if (mode !== 'multimodal') return
    if (hasAutoPopulatedOnce) return
    if (materialCount > 0) return
    void autoPopulateResources()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, hasAutoPopulatedOnce, materialCount, topic, selectedClass?.year_group, selectedClass?.subject])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClass) return
    if (criteria.length === 0) {
      setError('Select at least one criterion.')
      return
    }
    if (mode === 'multimodal' && materialCount === 0) {
      setError('Add at least one learning material for multimodal assessments.')
      return
    }

    setLoading(true)
    setError(null)

    const { data: created, error: insertError } = await supabase
      .from('assessments')
      .insert({
        class_id: classId,
        title,
        description: description || null,
        subject: selectedClass.subject,
        topic,
        year_group: selectedClass.year_group,
        criteria,
        max_questions: maxQuestions,
        allow_group: false,
        max_group_size: 1,
        topic_context: topicContext || null,
        system_prompt: customInstructions || null,
        status: 'draft',
        access_code: generateAccessCode(),
        assessment_mode: mode,
        tab_lock_enabled: mode === 'multimodal' ? tabLockEnabled : false,
        proctoring_enabled: mode === 'multimodal' ? proctoringEnabled : false,
      })
      .select('id')
      .single()

    if (insertError || !created) {
      if ((insertError as any)?.message?.includes('assessment_mode')) {
        setError('Database migration missing. Run migration 003_multimodal_assessment_foundation.sql first.')
      } else {
        setError(insertError?.message ?? 'Failed to create assessment.')
      }
      setLoading(false)
      return
    }

    if (mode === 'multimodal') {
      const assessmentId = created.id
      const warnings: string[] = []
      let order = 1

      for (const file of files) {
        const safeName = file.name.replace(/\s+/g, '_')
        const storagePath = `${assessmentId}/${Date.now()}-${safeName}`
        const { error: uploadError } = await supabase
          .storage
          .from('learning-materials')
          .upload(storagePath, file)

        if (uploadError) {
          warnings.push(`Could not upload ${file.name}: ${uploadError.message}`)
          continue
        }

        const { error: materialError } = await supabase
          .from('learning_materials')
          .insert({
            assessment_id: assessmentId,
            title: file.name,
            type: inferMaterialType(file.name),
            original_filename: file.name,
            storage_path: storagePath,
            file_size_bytes: file.size,
            processing_status: 'pending',
            display_order: order++,
            show_during_assessment: true,
          })

        if (materialError) {
          warnings.push(`Could not save material row for ${file.name}: ${materialError.message}`)
        }
      }

      for (const url of youtubeUrls) {
        const { error: materialError } = await supabase
          .from('learning_materials')
          .insert({
            assessment_id: assessmentId,
            title: `YouTube: ${url}`,
            type: 'youtube',
            material_data: { url },
            processing_status: 'pending',
            display_order: order++,
            show_during_assessment: true,
          })
        if (materialError) warnings.push(`Could not save YouTube URL: ${materialError.message}`)
      }

      for (const url of websiteUrls) {
        const { error: materialError } = await supabase
          .from('learning_materials')
          .insert({
            assessment_id: assessmentId,
            title: `Website: ${url}`,
            type: 'website',
            material_data: { url },
            processing_status: 'pending',
            display_order: order++,
            show_during_assessment: true,
          })
        if (materialError) warnings.push(`Could not save website URL: ${materialError.message}`)
      }

      for (const entry of rawTexts) {
        const { error: materialError } = await supabase
          .from('learning_materials')
          .insert({
            assessment_id: assessmentId,
            title: entry.title,
            type: 'text',
            extracted_text: entry.content,
            material_data: { source: 'teacher_raw_text' },
            processing_status: 'ready',
            display_order: order++,
            show_during_assessment: true,
          })
        if (materialError) warnings.push(`Could not save text material "${entry.title}": ${materialError.message}`)
      }

      if (warnings.length > 0) {
        console.warn('[multimodal-create] warnings', warnings)
      }
    }

    router.push('/assessments')
    router.refresh()
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(MULTIMODAL_DRAFT_KEY)
    }
  }

  if (classes.length === 0) {
    return (
      <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
        <p className="text-gray-600 mb-4">You need a class before creating an assessment.</p>
        <Link
          href="/classes/new"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Create a class first
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setMode('voice')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === 'voice' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Standard Voice Assessment
          </button>
          <button
            type="button"
            onClick={() => setMode('multimodal')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              mode === 'multimodal' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Multimodal Assessment Agent
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Details</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Assessment title</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={mode === 'multimodal' ? 'e.g. Waves Multimodal Viva' : 'e.g. Unit 3 Waves Oral Assessment'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description for your records"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Class</label>
          <select
            value={classId}
            onChange={(e) => handleClassChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} — {c.programme} {c.year_group} · {c.subject}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Topic</label>
          {availableTopics.length > 0 ? (
            <select
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableTopics.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          ) : (
            <input
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter topic name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Assessment Settings</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">MYP Criteria to assess</label>
          <div className="space-y-2">
            {CRITERIA.map((c) => (
              <label key={c.value} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={criteria.includes(c.value)}
                  onChange={() => toggleCriterion(c.value)}
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{c.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Number of questions</label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={3}
              max={10}
              value={maxQuestions}
              onChange={(e) => setMaxQuestions(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm font-semibold text-gray-900 w-6 text-center">{maxQuestions}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Recommended: 6 questions (~15 min session)</p>
        </div>
      </div>

      {mode === 'multimodal' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Learning Materials & Context
          </h2>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => saveDraftToLocalStorage(true)}
              className="px-3 py-2 rounded-lg bg-gray-100 text-sm hover:bg-gray-200 transition-colors"
            >
              Save multimodal draft
            </button>
            <button
              type="button"
              onClick={() => loadDraftFromLocalStorage(true)}
              disabled={!draftExists}
              className="px-3 py-2 rounded-lg bg-gray-100 text-sm hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Load saved draft
            </button>
            <button
              type="button"
              onClick={clearDraftFromLocalStorage}
              disabled={!draftExists}
              className="px-3 py-2 rounded-lg bg-gray-100 text-sm hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Clear saved draft
            </button>
            <button
              type="button"
              onClick={autoPopulateResources}
              disabled={autoPopulateLoading}
              className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm hover:bg-blue-100 disabled:opacity-50 transition-colors"
            >
              {autoPopulateLoading ? 'Finding resources…' : 'Auto-populate resources'}
            </button>
          </div>
          {saveDraftMessage && (
            <p className="text-xs text-green-700">{saveDraftMessage}</p>
          )}
          {autoPopulateError && (
            <p className="text-xs text-amber-700">{autoPopulateError}</p>
          )}
          <p className="text-xs text-gray-500 -mt-1">
            Upload what students learned from. The multimodal agent will use these materials when generating questions.
            Saved draft restores text/URLs/settings. File uploads are browser-local and must be re-selected.
          </p>

          <div className="rounded-xl border border-dashed border-gray-300 p-4">
            <label className="text-sm font-medium text-gray-700 block mb-2">Files (PDF, DOCX, PPTX, MP4, JPG, PNG)</label>
            <input
              type="file"
              multiple
              onChange={(e) => {
                const selected = Array.from(e.target.files ?? [])
                setFiles((prev) => [...prev, ...selected])
                e.currentTarget.value = ''
              }}
              className="block w-full text-sm text-gray-700"
            />
            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((f, idx) => (
                  <li key={`${f.name}-${idx}`} className="flex items-center justify-between text-sm rounded border border-gray-200 px-3 py-2">
                    <span className="truncate pr-3">
                      {inferMaterialType(f.name) === 'image' ? <ImageIcon size={14} className="inline mr-2" /> : null}
                      {inferMaterialType(f.name) === 'video' ? <Video size={14} className="inline mr-2" /> : null}
                      {inferMaterialType(f.name) === 'pdf' || inferMaterialType(f.name) === 'docx' || inferMaterialType(f.name) === 'pptx'
                        ? <FilePlus2 size={14} className="inline mr-2" />
                        : null}
                      {f.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-gray-200 p-4">
              <label className="text-sm font-medium text-gray-700 block mb-2">
                <Youtube size={14} className="inline mr-1" />
                YouTube URL
              </label>
              <div className="flex gap-2">
                <input
                  value={youtubeInput}
                  onChange={(e) => setYoutubeInput(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button type="button" onClick={pushYouTube} className="px-3 py-2 rounded-lg bg-gray-100 text-sm">
                  Add
                </button>
              </div>
              {youtubeUrls.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-gray-600">
                  {youtubeUrls.map((url, idx) => (
                    <li key={`${url}-${idx}`} className="flex justify-between gap-2">
                      <span className="truncate">{url}</span>
                      <button type="button" onClick={() => setYoutubeUrls((prev) => prev.filter((_, i) => i !== idx))}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-xl border border-gray-200 p-4">
              <label className="text-sm font-medium text-gray-700 block mb-2">
                <Globe size={14} className="inline mr-1" />
                Website / Article URL
              </label>
              <div className="flex gap-2">
                <input
                  value={websiteInput}
                  onChange={(e) => setWebsiteInput(e.target.value)}
                  placeholder="https://example.com/article"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button type="button" onClick={pushWebsite} className="px-3 py-2 rounded-lg bg-gray-100 text-sm">
                  Add
                </button>
              </div>
              {websiteUrls.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-gray-600">
                  {websiteUrls.map((url, idx) => (
                    <li key={`${url}-${idx}`} className="flex justify-between gap-2">
                      <span className="truncate">{url}</span>
                      <button type="button" onClick={() => setWebsiteUrls((prev) => prev.filter((_, i) => i !== idx))}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 p-4">
            <label className="text-sm font-medium text-gray-700 block mb-2">
              <FileText size={14} className="inline mr-1" />
              Raw Text Notes
            </label>
            <div className="grid gap-2">
              <input
                value={rawTextTitle}
                onChange={(e) => setRawTextTitle(e.target.value)}
                placeholder="Title (e.g. Week 3 class discussion)"
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <textarea
                rows={4}
                value={rawTextContent}
                onChange={(e) => setRawTextContent(e.target.value)}
                placeholder="Paste lecture notes, summary, forum prompts, or rubric context..."
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none"
              />
              <div>
                <button type="button" onClick={pushRawText} className="px-3 py-2 rounded-lg bg-gray-100 text-sm">
                  Add Text Material
                </button>
              </div>
            </div>
            {rawTexts.length > 0 && (
              <ul className="mt-3 space-y-2">
                {rawTexts.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between rounded border border-gray-200 px-3 py-2 text-sm">
                    <span>{entry.title}</span>
                    <button
                      type="button"
                      onClick={() => setRawTexts((prev) => prev.filter((x) => x.id !== entry.id))}
                      className="text-gray-400 hover:text-red-600"
                    >
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-gray-200 p-4 space-y-2">
            <p className="text-sm font-medium text-gray-700">Academic integrity controls</p>
            <label className="flex items-center gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={tabLockEnabled}
                onChange={(e) => setTabLockEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              Enable tab lock monitoring (visibility/focus events)
            </label>
            <label className="flex items-center gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={proctoringEnabled}
                onChange={(e) => setProctoringEnabled(e.target.checked)}
                className="w-4 h-4"
              />
              Enable webcam proctoring flag (snapshot worker can be connected later)
            </label>
          </div>

          <p className="text-xs text-gray-500">
            Materials added: <span className="font-semibold">{materialCount}</span>
          </p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">AI Context</h2>
        <p className="text-xs text-gray-400 -mt-2">
          Help the AI ask more relevant questions based on what you taught.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            What was covered in class <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows={3}
            value={topicContext}
            onChange={(e) => setTopicContext(e.target.value)}
            placeholder="e.g. We covered wave properties, the wave equation, and did a lab on standing waves."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Custom instructions for AI <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows={2}
            value={customInstructions}
            onChange={(e) => setCustomInstructions(e.target.value)}
            placeholder={mode === 'multimodal'
              ? 'e.g. Prioritize lab report graphs and ask at least one data-analysis question.'
              : 'e.g. Focus questions on the wave equation and real-world applications.'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex justify-end gap-3">
        <Link href="/assessments" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Creating…' : mode === 'multimodal' ? 'Create multimodal assessment' : 'Create assessment'}
        </button>
      </div>
    </form>
  )
}
