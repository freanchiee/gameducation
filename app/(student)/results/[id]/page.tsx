import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { CheckCircle, TrendingUp, MessageSquareQuote } from 'lucide-react'

const LEVEL_BANDS = [
  { min: 0, max: 0, label: 'Not Assessed', color: 'bg-gray-100 text-gray-600', border: 'border-gray-200' },
  { min: 1, max: 2, label: 'Limited (1–2)', color: 'bg-red-50 text-red-700', border: 'border-red-200' },
  { min: 3, max: 4, label: 'Adequate (3–4)', color: 'bg-yellow-50 text-yellow-700', border: 'border-yellow-200' },
  { min: 5, max: 6, label: 'Substantial (5–6)', color: 'bg-blue-50 text-blue-700', border: 'border-blue-200' },
  { min: 7, max: 8, label: 'Excellent (7–8)', color: 'bg-green-50 text-green-700', border: 'border-green-200' },
]

function getLevelBand(level: number) {
  return LEVEL_BANDS.find((b) => level >= b.min && level <= b.max) ?? LEVEL_BANDS[0]
}

export default async function ResultsPage({ params }: { params: { id: string } }) {
  const supabase = await createClient()

  const { data: evaluation } = await supabase
    .from('evaluations')
    .select(`
      *,
      sessions(assessments(title, topic, year_group))
    `)
    .eq('id', params.id)
    .single()

  if (!evaluation) notFound()

  const band = getLevelBand(evaluation.criterion_a_level ?? 0)
  const assessment = (evaluation.sessions as any)?.assessments

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
            <p className="text-gray-500 mt-1">
              {assessment.title} · {assessment.topic}
            </p>
          )}
        </div>

        {/* Level badge */}
        <div className={`p-6 rounded-2xl border-2 ${band.border} ${band.color} text-center`}>
          <p className="text-sm font-medium uppercase tracking-wider opacity-70 mb-2">
            Criterion A – Knowing &amp; Understanding
          </p>
          <div className="text-6xl font-bold mb-2">
            {evaluation.criterion_a_level ?? '–'}
            <span className="text-2xl">/8</span>
          </div>
          <p className="text-xl font-semibold">{band.label}</p>
        </div>

        {/* Strengths */}
        {evaluation.strengths && (evaluation.strengths as string[]).length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle size={18} className="text-green-500" />
              <h2 className="font-semibold text-gray-900">Strengths</h2>
            </div>
            <ul className="space-y-2">
              {(evaluation.strengths as string[]).map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Areas for growth */}
        {evaluation.areas_for_growth && (evaluation.areas_for_growth as string[]).length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={18} className="text-blue-500" />
              <h2 className="font-semibold text-gray-900">Areas for Growth</h2>
            </div>
            <ul className="space-y-2">
              {(evaluation.areas_for_growth as string[]).map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Evidence quotes */}
        {evaluation.evidence_quotes && (evaluation.evidence_quotes as string[]).length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquareQuote size={18} className="text-purple-500" />
              <h2 className="font-semibold text-gray-900">What You Said</h2>
            </div>
            <div className="space-y-3">
              {(evaluation.evidence_quotes as string[]).map((q, i) => (
                <blockquote key={i} className="border-l-4 border-purple-200 pl-4 text-sm text-gray-700 italic">
                  &ldquo;{q}&rdquo;
                </blockquote>
              ))}
            </div>
          </div>
        )}

        {/* Student feedback */}
        {evaluation.feedback_student && (
          <div className="bg-blue-600 rounded-2xl p-6 text-white">
            <h2 className="font-semibold mb-3">Feedback For You</h2>
            <p className="text-blue-100 text-sm leading-relaxed">{evaluation.feedback_student}</p>
          </div>
        )}

        <p className="text-center text-xs text-gray-400 pb-4">
          Your teacher has been notified of your completion.
        </p>
      </div>
    </div>
  )
}
