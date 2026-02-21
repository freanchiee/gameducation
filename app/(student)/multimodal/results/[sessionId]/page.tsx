import { createAdminClient } from '@/lib/supabase/admin'
import { CheckCircle, TrendingUp, AlertCircle, BarChart3 } from 'lucide-react'

const LEVEL_BANDS = [
  { min: 0, max: 0, label: 'Not Assessed', color: 'bg-gray-100 text-gray-600', border: 'border-gray-200', bar: 'bg-gray-300' },
  { min: 1, max: 2, label: 'Limited (1–2)', color: 'bg-red-50 text-red-700', border: 'border-red-200', bar: 'bg-red-400' },
  { min: 3, max: 4, label: 'Adequate (3–4)', color: 'bg-yellow-50 text-yellow-700', border: 'border-yellow-200', bar: 'bg-yellow-400' },
  { min: 5, max: 6, label: 'Substantial (5–6)', color: 'bg-blue-50 text-blue-700', border: 'border-blue-200', bar: 'bg-blue-500' },
  { min: 7, max: 8, label: 'Excellent (7–8)', color: 'bg-green-50 text-green-700', border: 'border-green-200', bar: 'bg-green-500' },
]

const CRITERION_NAMES: Record<string, { name: string; descriptor: string }> = {
  A: { name: 'Criterion A', descriptor: 'Knowing & Understanding' },
  B: { name: 'Criterion B', descriptor: 'Inquiring & Designing' },
  C: { name: 'Criterion C', descriptor: 'Processing & Evaluating' },
  D: { name: 'Criterion D', descriptor: 'Reflecting on the Impacts' },
}

function getLevelBand(level: number) {
  return LEVEL_BANDS.find((b) => level >= b.min && level <= b.max) ?? LEVEL_BANDS[0]
}

type ScoringDecision = {
  criterion: string
  rubric_level: number
  rubric_level_band: string
  justification: string
  confidence_score: number
  evidence_summary: {
    task_count: number
    weighted_average: number
    variance: number
    unstable_variation_flag: boolean
    tasks?: Array<{ task_type: string; difficulty: number; correctness: number; indicated_level: number }>
  }
}

export default async function MultimodalResultsPage({ params }: { params: { sessionId: string } }) {
  const supabase = createAdminClient()

  // Find participant for this session (most recent active one)
  const { data: participants } = await supabase
    .from('session_participants')
    .select('id')
    .eq('session_id', params.sessionId)
    .order('created_at', { ascending: false })
    .limit(1)

  const participantId = participants?.[0]?.id

  const { data: decisions } = participantId
    ? await supabase
        .from('scoring_decisions')
        .select('criterion, rubric_level, rubric_level_band, justification, confidence_score, evidence_summary')
        .eq('participant_id', participantId)
        .order('criterion', { ascending: true })
    : { data: null }

  const { data: session } = await supabase
    .from('sessions')
    .select('id, status, assessments(title, topic, year_group)')
    .eq('id', params.sessionId)
    .single()

  const assessment = (session as any)?.assessments

  if (!decisions || decisions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-10 px-4">
        <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-gray-200 p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={28} className="text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Assessment Processing</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Your results are being finalised. This usually takes a moment. Ask your teacher to check the dashboard.
          </p>
        </div>
      </div>
    )
  }

  const scoredDecisions = decisions as ScoringDecision[]
  const overallAvg = scoredDecisions.length > 0
    ? Math.round(scoredDecisions.reduce((s, d) => s + d.rubric_level, 0) / scoredDecisions.length)
    : 0
  const overallBand = getLevelBand(overallAvg)

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Assessment Complete</h1>
          {assessment && (
            <p className="text-gray-500 mt-1 text-sm">
              {assessment.title} · {assessment.topic}
              {assessment.year_group ? ` · Year ${assessment.year_group}` : ''}
            </p>
          )}
        </div>

        {/* Overall summary */}
        <div className={`p-6 rounded-2xl border-2 text-center ${overallBand.border} ${overallBand.color}`}>
          <p className="text-sm font-semibold uppercase tracking-wider opacity-70 mb-2">Overall Performance</p>
          <div className="text-5xl font-bold mb-1">
            {overallAvg}<span className="text-2xl">/8</span>
          </div>
          <p className="text-lg font-semibold">{overallBand.label}</p>
        </div>

        {/* Per-criterion breakdown */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={18} className="text-blue-500" />
            <h2 className="font-semibold text-gray-900">Criterion Scores</h2>
          </div>
          <div className="space-y-4">
            {scoredDecisions.map((decision) => {
              const band = getLevelBand(decision.rubric_level)
              const critInfo = CRITERION_NAMES[decision.criterion] ?? { name: `Criterion ${decision.criterion}`, descriptor: '' }
              const taskCount = decision.evidence_summary?.task_count ?? 0
              const confidence = decision.confidence_score ?? 0
              return (
                <div key={decision.criterion} className={`rounded-xl border p-4 ${band.border}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{critInfo.name}</p>
                      <p className="text-xs text-gray-500">{critInfo.descriptor}</p>
                    </div>
                    <div className={`text-right px-3 py-1 rounded-lg ${band.color}`}>
                      <p className="text-xl font-bold leading-none">{decision.rubric_level}<span className="text-sm">/8</span></p>
                      <p className="text-[10px] font-medium">{band.label}</p>
                    </div>
                  </div>

                  {/* Level bar */}
                  <div className="w-full h-2 rounded-full bg-gray-200 overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full ${band.bar} transition-all`}
                      style={{ width: `${(decision.rubric_level / 8) * 100}%` }}
                    />
                  </div>

                  {/* Justification */}
                  <p className="text-sm text-gray-700 leading-snug mb-2">{decision.justification}</p>

                  {/* Meta */}
                  <div className="flex gap-3 text-[11px] text-gray-400">
                    <span>{taskCount} task{taskCount !== 1 ? 's' : ''} completed</span>
                    <span>Confidence: {Math.round(confidence * 100)}%</span>
                    {decision.evidence_summary?.unstable_variation_flag && (
                      <span className="text-amber-500">⚠ Review recommended</span>
                    )}
                  </div>

                  {/* Task breakdown (collapsed mini-list) */}
                  {decision.evidence_summary?.tasks && decision.evidence_summary.tasks.length > 0 && (
                    <details className="mt-2">
                      <summary className="text-[11px] text-blue-600 cursor-pointer hover:underline">
                        Show evidence trail ({decision.evidence_summary.tasks.length} tasks)
                      </summary>
                      <div className="mt-2 space-y-1">
                        {decision.evidence_summary.tasks.map((t, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px] text-gray-600 bg-gray-50 rounded px-2 py-1">
                            <span className="font-medium text-gray-800 capitalize">{t.task_type.replaceAll('_', ' ')}</span>
                            <span className="text-gray-400">·</span>
                            <span>Difficulty {t.difficulty}</span>
                            <span className="text-gray-400">·</span>
                            <span>Correctness {Math.round(t.correctness * 100)}%</span>
                            <span className="text-gray-400">·</span>
                            <span>Level {t.indicated_level}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Next steps */}
        <div className="bg-blue-600 rounded-2xl p-6 text-white">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={18} />
            <h2 className="font-semibold">What's Next?</h2>
          </div>
          <ul className="space-y-2 text-sm text-blue-100">
            <li className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-300 flex-shrink-0" />
              Your teacher has received your results and will review them.
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-300 flex-shrink-0" />
              Review the evidence trail above to understand which tasks contributed to each score.
            </li>
            {scoredDecisions.some((d) => d.evidence_summary?.unstable_variation_flag) && (
              <li className="flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-amber-300 flex-shrink-0" />
                Some criteria show high variation — your teacher may request a follow-up discussion.
              </li>
            )}
          </ul>
        </div>

        <p className="text-center text-xs text-gray-400 pb-4">
          Results generated by VoiceIQ Multimodal Assessment Engine
        </p>
      </div>
    </div>
  )
}
