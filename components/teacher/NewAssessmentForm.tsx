'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import {
  Class,
  Assessment,
  AssessmentCriterion,
  AssessmentMode,
  MultimodalEngineMode,
  MultimodalTaskType,
} from '@/lib/types'
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

const TASK_LIBRARY: { value: MultimodalTaskType; label: string; hint: string }[] = [
  { value: 'simulation_probe', label: 'Simulation Probe', hint: 'Explore sliders/variables in a sim and infer patterns.' },
  { value: 'graph_analysis', label: 'Graph Analysis', hint: 'Interpret trends, anomalies, and relationships from graphs.' },
  { value: 'table_completion', label: 'Table Completion', hint: 'Populate data table from observed/derived values.' },
  { value: 'iv_dv_cv_sort', label: 'IV/DV/CV Sort', hint: 'Classify variables into independent/dependent/controlled.' },
  { value: 'matching', label: 'Matching', hint: 'Match concepts, evidence, and reasoning pairs.' },
  { value: 'fill_blank', label: 'Fill in the Blank', hint: 'Complete structured scientific statements accurately.' },
  { value: 'short_answer', label: 'Short Answer', hint: 'Concise explanation with justification/evidence.' },
  { value: 'extended_response', label: 'Extended Response', hint: 'Long-form reasoning and evaluation response.' },
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

function normalizeSimulationEmbedUrl(input: string) {
  const raw = input.trim()
  if (!raw) return raw
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      let id = ''
      if (host.includes('youtu.be')) {
        id = u.pathname.replace('/', '')
      } else {
        id = u.searchParams.get('v') ?? ''
      }
      return id ? `https://www.youtube.com/embed/${id}` : raw
    }

    if (host.includes('geogebra.org')) {
      const parts = u.pathname.split('/').filter(Boolean)
      const id = parts[parts.length - 1]
      if (id) return `https://www.geogebra.org/material/iframe/id/${id}/width/960/height/540/border/888888/rc/false/ai/false`
    }

    return raw
  } catch {
    return raw
  }
}

interface Props {
  classes: Class[]
  initialServerDraftId?: string
  mode?: 'create' | 'edit'
  assessmentId?: string
  initialAssessment?: Assessment
  initialMaterials?: Array<{
    id: string
    title: string
    type: string
    material_data: Record<string, unknown> | null
    extracted_text: string | null
    storage_path?: string | null
    original_filename?: string | null
    file_size_bytes?: number | null
  }>
}

type RawTextItem = { id: string; title: string; content: string }
type ExistingUploadedFile = {
  id: string
  title: string
  type: string
  storage_path: string | null
  original_filename: string | null
  file_size_bytes: number | null
  remove: boolean
  replacementFile: File | null
}
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
  multimodalEngineMode: MultimodalEngineMode
  multimodalTaskTypes: MultimodalTaskType[]
  youtubeUrls: string[]
  simulationUrls: string[]
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

export default function NewAssessmentForm({
  classes,
  initialServerDraftId,
  mode = 'create',
  assessmentId,
  initialAssessment,
  initialMaterials = [],
}: Props) {
  const router = useRouter()
  const supabase = createClient()
  const firstClass = classes[0]

  const [modeState, setModeState] = useState<AssessmentMode>(initialAssessment?.assessment_mode ?? 'voice')
  const [classId, setClassId] = useState(initialAssessment?.class_id ?? firstClass?.id ?? '')
  const [selectedClass, setSelectedClass] = useState<Class | undefined>(
    classes.find((c) => c.id === initialAssessment?.class_id) ?? firstClass
  )
  const [title, setTitle] = useState(initialAssessment?.title ?? '')
  const [description, setDescription] = useState(initialAssessment?.description ?? '')
  const [topic, setTopic] = useState(() => {
    if (initialAssessment?.topic) return initialAssessment.topic
    if (!firstClass) return ''
    const topics = SUBJECT_TOPICS[firstClass.subject]?.[firstClass.year_group]
    return topics?.[0] ?? ''
  })
  const [criteria, setCriteria] = useState<AssessmentCriterion[]>(
    initialAssessment?.criteria?.length ? initialAssessment.criteria : ['A']
  )
  const [maxQuestions, setMaxQuestions] = useState(initialAssessment?.max_questions ?? 6)
  const [topicContext, setTopicContext] = useState(initialAssessment?.topic_context ?? '')
  const [customInstructions, setCustomInstructions] = useState(initialAssessment?.system_prompt ?? '')
  const [tabLockEnabled, setTabLockEnabled] = useState(Boolean(initialAssessment?.tab_lock_enabled))
  const [proctoringEnabled, setProctoringEnabled] = useState(Boolean(initialAssessment?.proctoring_enabled))
  const [multimodalEngineMode, setMultimodalEngineMode] = useState<MultimodalEngineMode>(
    initialAssessment?.multimodal_engine_mode ?? 'auto'
  )
  const [multimodalTaskTypes, setMultimodalTaskTypes] = useState<MultimodalTaskType[]>([
    ...(
      initialAssessment?.multimodal_task_types?.length
        ? (initialAssessment.multimodal_task_types as MultimodalTaskType[])
        : (['simulation_probe', 'graph_analysis', 'table_completion', 'iv_dv_cv_sort', 'matching', 'short_answer'] as MultimodalTaskType[])
    ),
  ])

  const [files, setFiles] = useState<File[]>([])
  const [youtubeInput, setYoutubeInput] = useState('')
  const [simulationInput, setSimulationInput] = useState('')
  const [websiteInput, setWebsiteInput] = useState('')
  const [youtubeUrls, setYoutubeUrls] = useState<string[]>([])
  const [simulationUrls, setSimulationUrls] = useState<string[]>([])
  const [websiteUrls, setWebsiteUrls] = useState<string[]>([])
  const [rawTextTitle, setRawTextTitle] = useState('')
  const [rawTextContent, setRawTextContent] = useState('')
  const [rawTexts, setRawTexts] = useState<RawTextItem[]>([])
  const [existingUploadedFiles, setExistingUploadedFiles] = useState<ExistingUploadedFile[]>([])

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
  const [previewMode, setPreviewMode] = useState<'docked' | 'floating' | 'half'>('docked')

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
    () => files.length + youtubeUrls.length + simulationUrls.length + websiteUrls.length + rawTexts.length,
    [files.length, youtubeUrls.length, simulationUrls.length, websiteUrls.length, rawTexts.length]
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

  function pushSimulation() {
    const v = simulationInput.trim()
    if (!v) return
    setSimulationUrls((prev) => [...prev, normalizeSimulationEmbedUrl(v)])
    setSimulationInput('')
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
      mode: modeState,
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
      multimodalEngineMode,
      multimodalTaskTypes,
      youtubeUrls,
      simulationUrls,
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
      applyDraft(draft)
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
    setModeState(draft.mode ?? 'multimodal')
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
    setMultimodalEngineMode((draft.multimodalEngineMode ?? 'auto') as MultimodalEngineMode)
    setMultimodalTaskTypes(
      Array.isArray(draft.multimodalTaskTypes) && draft.multimodalTaskTypes.length > 0
        ? draft.multimodalTaskTypes
        : ['simulation_probe', 'graph_analysis', 'table_completion', 'iv_dv_cv_sort', 'matching', 'short_answer']
    )
    setYoutubeUrls(Array.isArray(draft.youtubeUrls) ? draft.youtubeUrls : [])
    setSimulationUrls(Array.isArray(draft.simulationUrls) ? draft.simulationUrls : [])
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
          mode: modeState,
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
          mode: modeState,
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
      if (simulationUrls.length === 0 && data.geogebra_url) {
        setSimulationUrls([normalizeSimulationEmbedUrl(data.geogebra_url)])
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

  function toggleTaskType(task: MultimodalTaskType) {
    setMultimodalTaskTypes((prev) =>
      prev.includes(task) ? prev.filter((t) => t !== task) : [...prev, task]
    )
  }

  useEffect(() => {
    if (!initialAssessment || initialMaterials.length === 0) return
    const simLinks: string[] = []
    const ytLinks: string[] = []
    const webLinks: string[] = []
    const txts: RawTextItem[] = []

    for (const material of initialMaterials) {
      if (material.type === 'youtube') {
        const url = typeof material.material_data?.url === 'string' ? material.material_data.url : ''
        if (url) ytLinks.push(url)
      } else if (material.type === 'website') {
        const kind = typeof material.material_data?.kind === 'string' ? material.material_data.kind : ''
        const url =
          (typeof material.material_data?.embed_url === 'string' && material.material_data.embed_url) ||
          (typeof material.material_data?.url === 'string' && material.material_data.url) ||
          ''
        if (url) {
          if (kind === 'simulation' || /simulation|geogebra|phet/i.test(material.title)) simLinks.push(url)
          else webLinks.push(url)
        }
      } else if (material.type === 'text' && material.extracted_text) {
        txts.push({
          id: material.id,
          title: material.title,
          content: material.extracted_text,
        })
      }
    }
    setSimulationUrls(simLinks)
    setYoutubeUrls(ytLinks)
    setWebsiteUrls(webLinks)
    setRawTexts(txts)
    const existingFiles = initialMaterials
      .filter((m) => ['pdf', 'docx', 'pptx', 'video', 'image'].includes(m.type))
      .map((m) => ({
        id: m.id,
        title: m.title,
        type: m.type,
        storage_path: m.storage_path ?? null,
        original_filename: m.original_filename ?? null,
        file_size_bytes: m.file_size_bytes ?? null,
        remove: false,
        replacementFile: null,
      }))
    setExistingUploadedFiles(existingFiles)
  }, [initialAssessment, initialMaterials])

  useEffect(() => {
    if (mode !== 'edit' || !initialAssessment) return
    setModeState(initialAssessment.assessment_mode ?? 'voice')
    setClassId(initialAssessment.class_id)
    const cls = classes.find((c) => c.id === initialAssessment.class_id)
    if (cls) setSelectedClass(cls)
    setTitle(initialAssessment.title ?? '')
    setDescription(initialAssessment.description ?? '')
    setTopic(initialAssessment.topic ?? '')
    setCriteria(initialAssessment.criteria?.length ? initialAssessment.criteria : ['A'])
    setMaxQuestions(initialAssessment.max_questions ?? 6)
    setTopicContext(initialAssessment.topic_context ?? '')
    setCustomInstructions(initialAssessment.system_prompt ?? '')
    setTabLockEnabled(Boolean(initialAssessment.tab_lock_enabled))
    setProctoringEnabled(Boolean(initialAssessment.proctoring_enabled))
    setMultimodalEngineMode(initialAssessment.multimodal_engine_mode ?? 'auto')
    setMultimodalTaskTypes(
      initialAssessment.multimodal_task_types?.length
        ? (initialAssessment.multimodal_task_types as MultimodalTaskType[])
        : (['simulation_probe', 'graph_analysis', 'table_completion', 'iv_dv_cv_sort', 'matching', 'short_answer'] as MultimodalTaskType[])
    )
  }, [mode, initialAssessment, classes])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(MULTIMODAL_DRAFT_KEY)
    if (!saved) return
    setDraftExists(true)
    if (mode === 'edit') return
    if (!title && !description && !topicContext && youtubeUrls.length === 0 && simulationUrls.length === 0 && websiteUrls.length === 0 && rawTexts.length === 0) {
      loadDraftFromLocalStorage(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mode === 'edit') return
    void fetchServerDrafts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (mode === 'edit') return
    if (modeState !== 'multimodal') return
    saveDraftToLocalStorage(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    modeState, classId, title, description, topic, criteria, maxQuestions, topicContext, customInstructions,
    tabLockEnabled, proctoringEnabled, multimodalEngineMode, multimodalTaskTypes, youtubeUrls, simulationUrls, websiteUrls, rawTexts
  ])

  useEffect(() => {
    if (mode === 'edit') return
    if (modeState !== 'multimodal') return
    if (hasAutoPopulatedOnce) return
    if (materialCount > 0) return
    void autoPopulateResources()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeState, hasAutoPopulatedOnce, materialCount, topic, selectedClass?.year_group, selectedClass?.subject])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClass) return
    let effectiveSimulationUrls = [...simulationUrls]
    if (modeState === 'multimodal' && effectiveSimulationUrls.length === 0) {
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
        if (res.ok) {
          const data = await res.json()
          if (data.geogebra_url) {
            effectiveSimulationUrls = [normalizeSimulationEmbedUrl(data.geogebra_url)]
            setSimulationUrls(effectiveSimulationUrls)
          }
        }
      } catch {
        // best effort: submission can continue without suggested simulation
      }
    }
    if (criteria.length === 0) {
      setError('Select at least one criterion.')
      return
    }
    const retainedExistingFileCount =
      mode === 'edit'
        ? existingUploadedFiles.filter((f) => !f.remove && !f.replacementFile).length
        : 0
    const effectiveMaterialCount =
      files.length + youtubeUrls.length + websiteUrls.length + rawTexts.length + effectiveSimulationUrls.length + retainedExistingFileCount
    if (modeState === 'multimodal' && effectiveMaterialCount === 0) {
      setError('Add at least one learning material for multimodal assessments.')
      return
    }
    if (modeState === 'multimodal' && multimodalEngineMode === 'advanced' && multimodalTaskTypes.length === 0) {
      setError('Select at least one multimodal task type in Advanced mode.')
      return
    }

    setLoading(true)
    setError(null)

    const payload = {
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
      assessment_mode: modeState,
      multimodal_engine_mode: modeState === 'multimodal' ? multimodalEngineMode : 'auto',
      multimodal_task_types:
        modeState === 'multimodal'
          ? (multimodalEngineMode === 'auto'
              ? TASK_LIBRARY.map((t) => t.value)
              : multimodalTaskTypes)
          : [],
      tab_lock_enabled: modeState === 'multimodal' ? tabLockEnabled : false,
      proctoring_enabled: modeState === 'multimodal' ? proctoringEnabled : false,
    }

    let targetAssessmentId = assessmentId ?? null
    if (mode === 'edit' && targetAssessmentId) {
      const { error: updateError } = await supabase
        .from('assessments')
        .update(payload)
        .eq('id', targetAssessmentId)
      if (updateError) {
        setError(updateError.message || 'Failed to update assessment.')
        setLoading(false)
        return
      }
    } else {
      const { data: created, error: insertError } = await supabase
        .from('assessments')
        .insert({
          ...payload,
          status: 'draft',
          access_code: generateAccessCode(),
        })
        .select('id')
        .single()

      if (!created?.id || insertError) {
        if (
          (insertError as any)?.message?.includes('assessment_mode') ||
          (insertError as any)?.message?.includes('multimodal_engine_mode') ||
          (insertError as any)?.message?.includes('multimodal_task_types')
        ) {
          setError('Database migration missing. Run migrations 003_multimodal_assessment_foundation.sql and 005_multimodal_engine_config.sql first.')
        } else {
          setError(insertError?.message ?? 'Failed to create assessment.')
        }
        setLoading(false)
        return
      }
      targetAssessmentId = created.id
    }

    if (!targetAssessmentId) {
      setError('Assessment ID missing after save.')
      setLoading(false)
      return
    }

    if (modeState === 'multimodal') {
      const assessmentId = targetAssessmentId
      const warnings: string[] = []
      let order = 1
      let existingRows: Array<{ id: string; type: string; storage_path: string | null; display_order?: number | null }> = []

      if (mode === 'edit') {
        const { data } = await supabase
          .from('learning_materials')
          .select('id, type, storage_path, display_order')
          .eq('assessment_id', assessmentId)
        existingRows = (data ?? []) as Array<{ id: string; type: string; storage_path: string | null; display_order?: number | null }>

        const fileEditsById = new Map(
          existingUploadedFiles.map((f) => [f.id, f] as const)
        )
        const toDelete = existingRows.filter((r) => {
          if (['youtube', 'website', 'text'].includes(r.type)) return true
          if (!['pdf', 'docx', 'pptx', 'video', 'image'].includes(r.type)) return false
          const edit = fileEditsById.get(r.id)
          return Boolean(edit?.remove || edit?.replacementFile)
        })

        const storagePathsToDelete = toDelete
          .map((r) => r.storage_path)
          .filter((p): p is string => Boolean(p))

        if (storagePathsToDelete.length > 0) {
          const { error: storageDeleteError } = await supabase.storage
            .from('learning-materials')
            .remove(storagePathsToDelete)
          if (storageDeleteError) {
            warnings.push(`Could not delete some old files from storage: ${storageDeleteError.message}`)
          }
        }

        if (toDelete.length > 0) {
          await supabase
            .from('learning_materials')
            .delete()
            .in('id', toDelete.map((r) => r.id))
        }

        const retained = existingRows.filter((r) => !toDelete.some((d) => d.id === r.id))
        const maxDisplay = retained.reduce((max, r) => Math.max(max, Number(r.display_order ?? 0)), 0)
        order = maxDisplay + 1
      }

      if (mode === 'edit') {
        for (const existing of existingUploadedFiles) {
          if (!existing.replacementFile) continue
          const file = existing.replacementFile
          const safeName = file.name.replace(/\s+/g, '_')
          const storagePath = `${assessmentId}/${Date.now()}-${safeName}`
          const { error: uploadError } = await supabase
            .storage
            .from('learning-materials')
            .upload(storagePath, file)

          if (uploadError) {
            warnings.push(`Could not upload replacement for ${existing.title}: ${uploadError.message}`)
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
            warnings.push(`Could not save replacement file ${file.name}: ${materialError.message}`)
          }
        }
      }

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

      for (const url of effectiveSimulationUrls) {
        const { error: materialError } = await supabase
          .from('learning_materials')
          .insert({
            assessment_id: assessmentId,
            title: `Simulation: ${url}`,
            type: 'website',
            material_data: { kind: 'simulation', url, embed_url: normalizeSimulationEmbedUrl(url) },
            processing_status: 'ready',
            display_order: order++,
            show_during_assessment: true,
          })
        if (materialError) warnings.push(`Could not save simulation URL: ${materialError.message}`)
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
        console.warn('[multimodal-save] warnings', warnings)
      }
    }

    if (activeServerDraftId) {
      await supabase.from('assessment_drafts').delete().eq('id', activeServerDraftId)
      setActiveServerDraftId(null)
    }

    router.push(mode === 'edit' && targetAssessmentId ? `/assessments/${targetAssessmentId}` : '/assessments')
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

  const previewCriteria = criteria.length > 0 ? criteria.map((c) => `Criterion ${c}`).join(', ') : 'No criteria selected'
  const previewTaskTypes =
    modeState === 'multimodal'
      ? (multimodalEngineMode === 'auto'
          ? TASK_LIBRARY.map((t) => t.label)
          : TASK_LIBRARY.filter((t) => multimodalTaskTypes.includes(t.value)).map((t) => t.label))
      : []
  const previewSimulationUrl = simulationUrls[0] ?? ''
  const previewPane = (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900">Live Preview</h3>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPreviewMode('docked')}
            className={`px-2 py-1 rounded text-[11px] border ${previewMode === 'docked' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
          >
            Docked
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('floating')}
            className={`px-2 py-1 rounded text-[11px] border ${previewMode === 'floating' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
          >
            Float
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('half')}
            className={`px-2 py-1 rounded text-[11px] border ${previewMode === 'half' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}
          >
            1/2 screen
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-3">
        <p className="text-xs uppercase tracking-wide text-gray-500">Examiner</p>
        <p className="mt-1 text-sm font-semibold text-gray-900">{title || 'Untitled assessment'}</p>
        <p className="text-xs text-gray-600 mt-1">{selectedClass?.subject || 'Subject'} • {topic || 'Topic'} • {selectedClass?.year_group || 'Year group'}</p>
        <p className="text-xs text-gray-600 mt-1">{previewCriteria}</p>
      </div>

      <div className="rounded-lg border border-gray-200 p-3 bg-gray-50">
        <p className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Sample examiner prompt</p>
        <p className="text-sm text-gray-800 mt-2">
          {modeState === 'multimodal'
            ? `Use the on-screen task for ${topic || 'the topic'}, then explain your observation with evidence.`
            : `Explain a key concept from ${topic || 'this topic'} and justify your reasoning.`}
        </p>
      </div>

      {modeState === 'multimodal' && (
        <div className="rounded-lg border border-gray-200 p-3 space-y-2">
          <p className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">Student side-task panel</p>
          <div className="flex flex-wrap gap-1">
            {previewTaskTypes.slice(0, 5).map((task) => (
              <span key={task} className="px-2 py-0.5 rounded-full text-[11px] bg-blue-50 text-blue-700 border border-blue-100">
                {task}
              </span>
            ))}
            {previewTaskTypes.length === 0 && (
              <span className="text-xs text-gray-500">No task types selected</span>
            )}
          </div>
          {previewSimulationUrl ? (
            <div className="rounded border border-gray-200 overflow-hidden">
              <iframe
                src={previewSimulationUrl}
                title="Simulation preview"
                className="w-full h-40"
              />
            </div>
          ) : (
            <div className="rounded border border-dashed border-gray-300 p-3 text-xs text-gray-500">
              Add a simulation URL to preview embedded media.
            </div>
          )}
          <div className="rounded border border-gray-200 bg-white p-2 text-xs text-gray-700">
            <p className="font-medium mb-1">Task response preview</p>
            <p className="text-gray-500">Input 1 / Output 1 / Note 1 ...</p>
            <p className="text-gray-500">Graph preview and screenshot evidence will appear in student view.</p>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-gray-200 p-3">
        <p className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">AI context</p>
        <p className="text-xs text-gray-600 mt-1 max-h-20 overflow-hidden">
          {customInstructions || topicContext || 'No additional context yet.'}
        </p>
      </div>
    </div>
  )

  return (
    <form onSubmit={handleSubmit}>
      <div className={`grid grid-cols-1 gap-6 items-start ${previewMode === 'docked' ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
      <div className={`space-y-6 ${previewMode === 'floating' ? 'xl:pr-[440px]' : previewMode === 'half' ? 'xl:pr-[52vw]' : ''}`}>
      <div className="hidden xl:flex justify-end">
        <div className="inline-flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => setPreviewMode('docked')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${previewMode === 'docked' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            Docked preview
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('floating')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${previewMode === 'floating' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            Floating preview
          </button>
          <button
            type="button"
            onClick={() => setPreviewMode('half')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${previewMode === 'half' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            Half-screen preview
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setModeState('voice')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              modeState === 'voice' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
            }`}
          >
            Standard Voice Assessment
          </button>
          <button
            type="button"
            onClick={() => setModeState('multimodal')}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              modeState === 'multimodal' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
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
            placeholder={modeState === 'multimodal' ? 'e.g. Waves Multimodal Viva' : 'e.g. Unit 3 Waves Oral Assessment'}
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

      {modeState === 'multimodal' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Learning Materials & Context
          </h2>
          {mode === 'create' && (
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
            <button
              type="button"
              onClick={saveDraftToServer}
              disabled={serverDraftLoading}
              className="px-3 py-2 rounded-lg bg-indigo-50 text-indigo-700 text-sm hover:bg-indigo-100 disabled:opacity-50 transition-colors"
            >
              {serverDraftLoading ? 'Saving...' : 'Save draft to server'}
            </button>
          </div>
          )}
          {mode === 'create' && (
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <select
              value={selectedServerDraftId}
              onChange={(e) => setSelectedServerDraftId(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">Select a server draft to load...</option>
              {serverDrafts.map((d) => (
                <option key={d.id} value={d.id}>
                  {(d.title || d.topic || 'Untitled draft')} · {new Date(d.updated_at).toLocaleString()}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={loadSelectedServerDraft}
              disabled={!selectedServerDraftId}
              className="px-3 py-2 rounded-lg bg-gray-100 text-sm hover:bg-gray-200 disabled:opacity-50 transition-colors"
            >
              Load server draft
            </button>
          </div>
          )}
          {mode === 'create' && saveDraftMessage && (
            <p className="text-xs text-green-700">{saveDraftMessage}</p>
          )}
          {autoPopulateError && (
            <p className="text-xs text-amber-700">{autoPopulateError}</p>
          )}
          <p className="text-xs text-gray-500 -mt-1">
            Upload what students learned from. The multimodal agent will use these materials when generating questions.
            Saved draft restores text/URLs/settings. File uploads are browser-local and must be re-selected.
          </p>

          <div className="rounded-xl border border-blue-100 bg-blue-50/40 p-4 space-y-2">
            <p className="text-sm font-semibold text-blue-900">Simulation-guided investigation (recommended)</p>
            <p className="text-xs text-blue-800">
              Add a simulation link if you want the examiner to guide students through variable manipulation,
              data tabulation, IV/DV/CV reasoning, and evidence-based observations.
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">Assessment engine behavior</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMultimodalEngineMode('auto')}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  multimodalEngineMode === 'auto' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Auto-configure from topic + materials
              </button>
              <button
                type="button"
                onClick={() => setMultimodalEngineMode('advanced')}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  multimodalEngineMode === 'advanced' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                Advanced (manual task selection)
              </button>
            </div>

            {multimodalEngineMode === 'advanced' && (
              <div className="grid gap-2 md:grid-cols-2">
                {TASK_LIBRARY.map((task) => (
                  <label
                    key={task.value}
                    className="border border-gray-200 rounded-lg px-3 py-2 flex items-start gap-2 cursor-pointer hover:border-gray-300"
                  >
                    <input
                      type="checkbox"
                      checked={multimodalTaskTypes.includes(task.value)}
                      onChange={() => toggleTaskType(task.value)}
                      className="mt-1 w-4 h-4"
                    />
                    <span>
                      <span className="text-sm font-medium text-gray-800">{task.label}</span>
                      <span className="block text-xs text-gray-500">{task.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-dashed border-gray-300 p-4">
            <label className="text-sm font-medium text-gray-700 block mb-2">Files (PDF, DOCX, PPTX, MP4, JPG, PNG)</label>
            {mode === 'edit' && existingUploadedFiles.length > 0 && (
              <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-xs font-semibold text-gray-700 mb-2">Existing uploaded files</p>
                <ul className="space-y-2">
                  {existingUploadedFiles.map((fileRow) => (
                    <li key={fileRow.id} className="rounded border border-gray-200 bg-white p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs text-gray-700 truncate">{fileRow.original_filename || fileRow.title}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setExistingUploadedFiles((prev) =>
                              prev.map((f) => f.id === fileRow.id ? { ...f, remove: !f.remove, replacementFile: f.remove ? f.replacementFile : null } : f)
                            )
                          }
                          className={`text-xs px-2 py-1 rounded ${
                            fileRow.remove ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-700'
                          }`}
                        >
                          {fileRow.remove ? 'Marked for removal' : 'Remove'}
                        </button>
                      </div>
                      {!fileRow.remove && (
                        <div className="mt-2 space-y-1">
                          <label className="text-[11px] text-gray-600">Replace this file (optional)</label>
                          <input
                            type="file"
                            onChange={(e) => {
                              const replacement = e.target.files?.[0] ?? null
                              setExistingUploadedFiles((prev) =>
                                prev.map((f) => f.id === fileRow.id ? { ...f, replacementFile: replacement } : f)
                              )
                            }}
                            className="block w-full text-xs text-gray-700"
                          />
                          {fileRow.replacementFile && (
                            <p className="text-[11px] text-blue-700">Replacement selected: {fileRow.replacementFile.name}</p>
                          )}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
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

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4">
              <label className="text-sm font-medium text-gray-700 block mb-2">
                <Globe size={14} className="inline mr-1" />
                Simulation URL
              </label>
              <div className="flex gap-2">
                <input
                  value={simulationInput}
                  onChange={(e) => setSimulationInput(e.target.value)}
                  placeholder="https://phet... / geogebra... / custom sim"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                />
                <button type="button" onClick={pushSimulation} className="px-3 py-2 rounded-lg bg-blue-100 text-blue-900 text-sm">
                  Add
                </button>
              </div>
              <p className="mt-2 text-xs text-gray-600">
                URL is auto-normalized to embed format when possible.
              </p>
              {simulationUrls.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-gray-600">
                  {simulationUrls.map((url, idx) => (
                    <li key={`${url}-${idx}`} className="flex justify-between gap-2">
                      <span className="truncate">{url}</span>
                      <button type="button" onClick={() => setSimulationUrls((prev) => prev.filter((_, i) => i !== idx))}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

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
            placeholder={modeState === 'multimodal'
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
          {loading ? (mode === 'edit' ? 'Saving…' : 'Creating…') : mode === 'edit' ? 'Save changes' : modeState === 'multimodal' ? 'Create multimodal assessment' : 'Create assessment'}
        </button>
      </div>
      </div>

      {previewMode === 'docked' && (
        <aside className="hidden xl:block">
          <div className="sticky top-6">{previewPane}</div>
        </aside>
      )}
      </div>
      {previewMode !== 'docked' && (
        <div
          className={`hidden xl:block fixed right-4 top-20 z-40 max-h-[calc(100vh-6rem)] overflow-auto ${
            previewMode === 'half' ? 'w-[50vw]' : 'w-[420px]'
          }`}
        >
          {previewPane}
        </div>
      )}
    </form>
  )
}
