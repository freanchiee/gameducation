'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Class, AssessmentCriterion, EmbedResource } from '@/lib/types'
import ResourceBuilder from '@/components/teacher/ResourceBuilder'

// Topics per subject per year group (mirrors lib/prompts/subjects.ts)
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

interface Props {
  classes: Class[]
}

export default function NewAssessmentForm({ classes }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const firstClass = classes[0]

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
  const [resources, setResources] = useState<EmbedResource[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClassChange(id: string) {
    setClassId(id)
    const cls = classes.find(c => c.id === id)
    setSelectedClass(cls)
    if (cls) {
      const topics = SUBJECT_TOPICS[cls.subject]?.[cls.year_group]
      setTopic(topics?.[0] ?? '')
    }
  }

  function toggleCriterion(c: AssessmentCriterion) {
    setCriteria(prev =>
      prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
    )
  }

  const availableTopics = selectedClass
    ? (SUBJECT_TOPICS[selectedClass.subject]?.[selectedClass.year_group] ?? [])
    : []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedClass) return
    if (criteria.length === 0) {
      setError('Select at least one criterion.')
      return
    }
    setLoading(true)
    setError(null)

    const { error: insertError } = await supabase.from('assessments').insert({
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
      resources,
      status: 'draft',
      access_code: generateAccessCode(),
    })

    if (insertError) {
      setError(insertError.message)
      setLoading(false)
    } else {
      router.push('/assessments')
      router.refresh()
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
      {/* Basic info */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Details</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Assessment title</label>
          <input
            required
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Unit 3 Waves Oral Assessment"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Description <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Brief description for your records"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Class</label>
          <select
            value={classId}
            onChange={e => handleClassChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {classes.map(c => (
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
              onChange={e => setTopic(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {availableTopics.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          ) : (
            <input
              required
              value={topic}
              onChange={e => setTopic(e.target.value)}
              placeholder="Enter topic name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          )}
        </div>
      </div>

      {/* Criteria + questions */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Assessment Settings</h2>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">MYP Criteria to assess</label>
          <div className="space-y-2">
            {CRITERIA.map(c => (
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
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Number of questions
          </label>
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={3}
              max={10}
              value={maxQuestions}
              onChange={e => setMaxQuestions(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-sm font-semibold text-gray-900 w-6 text-center">{maxQuestions}</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Recommended: 6 questions (~15 min session)</p>
        </div>
      </div>

      {/* AI context */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">AI Context</h2>
        <p className="text-xs text-gray-400 -mt-2">
          Help the AI ask more relevant questions based on what you've taught.
        </p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            What was covered in class <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            rows={3}
            value={topicContext}
            onChange={e => setTopicContext(e.target.value)}
            placeholder="e.g. We covered wave properties, the wave equation, and did a lab on standing waves. Students have not yet seen diffraction."
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
            onChange={e => setCustomInstructions(e.target.value)}
            placeholder="e.g. Focus questions on the wave equation and real-world applications."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
      </div>

      {/* Resources */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Resources <span className="normal-case font-normal text-gray-400">(optional)</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Add GeoGebra, PhET or YouTube links — or paste any embed code. Students see these
            alongside the conversation during the assessment.
          </p>
        </div>
        <ResourceBuilder resources={resources} onChange={setResources} />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex justify-end gap-3">
        <Link
          href="/assessments"
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Creating…' : 'Create assessment'}
        </button>
      </div>
    </form>
  )
}
