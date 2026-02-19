import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Quote } from 'lucide-react'
import ReviewButton from '@/components/teacher/ReviewButton'
import ScoreOverrideControl from '@/components/teacher/ScoreOverrideControl'
import { EvaluationReport } from '@/lib/types'

const LEVEL_BANDS = [
  { min: 0, max: 0, label: 'Not Assessed', color: 'bg-gray-100 text-gray-600', bar: 'bg-gray-300' },
  { min: 1, max: 2, label: 'Limited',      color: 'bg-red-100 text-red-700',    bar: 'bg-red-400' },
  { min: 3, max: 4, label: 'Adequate',     color: 'bg-yellow-100 text-yellow-700', bar: 'bg-yellow-400' },
  { min: 5, max: 6, label: 'Substantial',  color: 'bg-blue-100 text-blue-700',  bar: 'bg-blue-400' },
  { min: 7, max: 8, label: 'Excellent',    color: 'bg-green-100 text-green-700', bar: 'bg-green-400' },
]

function getLevelBand(level: number) {
  return LEVEL_BANDS.find(b => level >= b.min && level <= b.max) ?? LEVEL_BANDS[0]
}

interface CriterionRowProps {
  label: string
  level: number | null
  isOverridden?: boolean
}

function CriterionRow({ label, level, isOverridden = false }: CriterionRowProps) {
  const band = getLevelBand(level ?? 0)
  const pct = ((level ?? 0) / 8) * 100
  return (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium text-gray-700 w-40 shrink-0">{label}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all ${band.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full w-28 text-center ${band.color}`}>
        {level ?? '—'}/8 · {band.label}
      </span>
      {isOverridden && (
        <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
          Teacher override
        </span>
      )}
    </div>
  )
}

export default async function EvaluationDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: ev } = await supabase
    .from('evaluations')
    .select(
      `
      *,
      sessions(
        assessments(title, topic, year_group, classes(name, teacher_id))
      ),
      profiles:student_id(full_name, email)
    `
    )
    .eq('id', params.id)
    .single()

  if (!ev) notFound()

  // Ensure teacher owns this evaluation's class
  const teacherId = (ev.sessions as any)?.assessments?.classes?.teacher_id
  if (teacherId !== user!.id) notFound()

  const assessment = (ev.sessions as any)?.assessments
  const className = assessment?.classes?.name ?? '—'
  const studentName = (ev.profiles as any)?.full_name ?? 'Anonymous student'
  const report = ev.full_report as EvaluationReport | null
  const effectiveCriterionA = ev.teacher_override_level ?? ev.criterion_a_level

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="text-gray-400 hover:text-gray-600 transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{studentName}</h1>
            <p className="text-gray-500 mt-0.5 text-sm">
              {assessment?.title ?? 'Assessment'} · {className} · {assessment?.topic}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(ev.created_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <ReviewButton evaluationId={ev.id} reviewed={ev.reviewed_by_teacher ?? false} />
      </div>

      <ScoreOverrideControl
        evaluationId={ev.id}
        aiLevel={ev.criterion_a_level}
        initialOverride={ev.teacher_override_level}
      />

      {/* Criteria levels */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-5">
          Criterion Scores
        </h2>
        <div className="space-y-4">
          <CriterionRow
            label="A – Knowing & Understanding"
            level={effectiveCriterionA}
            isOverridden={ev.teacher_override_level !== null}
          />
          <CriterionRow label="B – Inquiring & Designing"  level={ev.criterion_b_level} />
          <CriterionRow label="C – Processing & Evaluating" level={ev.criterion_c_level} />
          <CriterionRow label="D – Reflecting on Impacts"  level={ev.criterion_d_level} />
        </div>
      </div>

      {/* Justification */}
      {report?.justification && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            AI Justification
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">{report.justification}</p>
        </div>
      )}

      {/* Strengths + Growth */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
        {ev.strengths && ev.strengths.length > 0 && (
          <div className="bg-green-50 rounded-xl border border-green-100 p-5">
            <h2 className="text-sm font-semibold text-green-800 mb-3">Strengths</h2>
            <ul className="space-y-2">
              {(ev.strengths as string[]).map((s, i) => (
                <li key={i} className="flex gap-2 text-sm text-green-900">
                  <span className="mt-0.5 text-green-500 shrink-0">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {ev.areas_for_growth && ev.areas_for_growth.length > 0 && (
          <div className="bg-amber-50 rounded-xl border border-amber-100 p-5">
            <h2 className="text-sm font-semibold text-amber-800 mb-3">Areas for Growth</h2>
            <ul className="space-y-2">
              {(ev.areas_for_growth as string[]).map((a, i) => (
                <li key={i} className="flex gap-2 text-sm text-amber-900">
                  <span className="mt-0.5 text-amber-500 shrink-0">→</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Evidence quotes */}
      {ev.evidence_quotes && (ev.evidence_quotes as string[]).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Evidence from Transcript
          </h2>
          <div className="space-y-3">
            {(ev.evidence_quotes as string[]).map((q, i) => (
              <blockquote
                key={i}
                className="flex gap-3 text-sm text-gray-700 italic bg-gray-50 rounded-lg p-3"
              >
                <Quote size={16} className="text-gray-300 shrink-0 mt-0.5" />
                {q}
              </blockquote>
            ))}
          </div>
        </div>
      )}

      {/* Student feedback */}
      {ev.feedback_student && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Feedback Shown to Student
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed">{ev.feedback_student}</p>
        </div>
      )}

      {/* Teacher notes */}
      {ev.notes_teacher && (
        <div className="bg-blue-50 rounded-xl border border-blue-100 p-6">
          <h2 className="text-sm font-semibold text-blue-800 uppercase tracking-wider mb-3">
            Teacher Notes (AI-generated)
          </h2>
          <p className="text-sm text-blue-900 leading-relaxed">{ev.notes_teacher}</p>
        </div>
      )}
    </div>
  )
}
