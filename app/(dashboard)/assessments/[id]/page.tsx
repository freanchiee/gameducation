import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Clock, PlayCircle, CheckCircle, ExternalLink, Pencil } from 'lucide-react'
import AssessmentActions from '@/components/teacher/AssessmentActions'
import TypingPermissions from '@/components/teacher/TypingPermissions'
import { AssessmentStatus } from '@/lib/types'

const STATUS_CONFIG: Record<AssessmentStatus, { label: string; Icon: typeof Clock; color: string }> = {
  draft:  { label: 'Draft',  Icon: Clock,        color: 'bg-gray-100 text-gray-700' },
  active: { label: 'Active', Icon: PlayCircle,    color: 'bg-green-100 text-green-700' },
  closed: { label: 'Closed', Icon: CheckCircle,   color: 'bg-blue-100 text-blue-700' },
}

export default async function AssessmentDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: assessment } = await supabase
    .from('assessments')
    .select('*, classes(name, year_group, programme, subject, teacher_id)')
    .eq('id', params.id)
    .single()

  if (!assessment) notFound()

  // Ensure the teacher owns this assessment's class
  if ((assessment.classes as any)?.teacher_id !== user!.id) notFound()

  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, mode, status, started_at, completed_at,
      evaluations(id, criterion_a_level, teacher_override_level, reviewed_by_teacher),
      session_participants(count)
    `)
    .eq('assessment_id', params.id)
    .order('started_at', { ascending: false })
    .limit(20)

  const { data: materials, error: materialsError } = await supabase
    .from('learning_materials')
    .select('id, title, type, processing_status, show_during_assessment, created_at')
    .eq('assessment_id', params.id)
    .order('display_order', { ascending: true })
    .limit(20)

  const cls = assessment.classes as any
  const status = assessment.status as AssessmentStatus
  const statusConf = STATUS_CONFIG[status]
  const StatusIcon = statusConf.Icon

  return (
    <div className="w-full">
      {/* Header */}
      <div className="flex items-start gap-3 mb-8">
        <Link href="/assessments" className="text-gray-400 hover:text-gray-600 transition-colors mt-1">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{assessment.title}</h1>
            <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusConf.color}`}>
              <StatusIcon size={12} />
              {statusConf.label}
            </span>
          </div>
          <p className="text-gray-500 text-sm">
            {cls?.name} · {cls?.programme} {cls?.year_group} · {assessment.topic}
          </p>
          {assessment.description && (
            <p className="text-gray-400 text-sm mt-1">{assessment.description}</p>
          )}
          <div className="mt-3">
            <Link
              href={`/assessments/${assessment.id}/edit`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-600 text-white text-xs font-semibold shadow-sm hover:bg-blue-700 transition-colors"
            >
              <Pencil size={12} />
              Edit assessment
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {/* Status + actions */}
        <div className="md:col-span-1 bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</h2>
          <AssessmentActions
            assessmentId={assessment.id}
            currentStatus={status}
            accessCode={assessment.access_code}
          />
        </div>

        {/* Settings summary */}
        <div className="md:col-span-2 bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Settings</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-gray-400">Subject</dt>
              <dd className="font-medium text-gray-900">{assessment.subject}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Topic</dt>
              <dd className="font-medium text-gray-900">{assessment.topic}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Questions</dt>
              <dd className="font-medium text-gray-900">{assessment.max_questions}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Mode</dt>
              <dd className="font-medium text-gray-900">
                {(assessment as any).assessment_mode === 'multimodal' ? 'Multimodal' : 'Voice'}
              </dd>
            </div>
            {(assessment as any).assessment_mode === 'multimodal' && (
              <div>
                <dt className="text-gray-400">Engine</dt>
                <dd className="font-medium text-gray-900 capitalize">
                  {(assessment as any).multimodal_engine_mode ?? 'auto'}
                </dd>
              </div>
            )}
            <div>
              <dt className="text-gray-400">Tab lock</dt>
              <dd className="font-medium text-gray-900">
                {(assessment as any).tab_lock_enabled ? 'Enabled' : 'Disabled'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400">Webcam proctoring</dt>
              <dd className="font-medium text-gray-900">
                {(assessment as any).proctoring_enabled ? 'Enabled' : 'Disabled'}
              </dd>
            </div>
            <div>
              <dt className="text-gray-400">Criteria</dt>
              <dd className="font-medium text-gray-900">
                {(assessment.criteria as string[]).map((c) => `Criterion ${c}`).join(', ')}
              </dd>
            </div>
            {(assessment as any).assessment_mode === 'multimodal' &&
              Array.isArray((assessment as any).multimodal_task_types) &&
              (assessment as any).multimodal_task_types.length > 0 && (
                <div className="col-span-2">
                  <dt className="text-gray-400 mb-0.5">Enabled task types</dt>
                  <dd className="text-gray-700 leading-snug">
                    {((assessment as any).multimodal_task_types as string[]).join(', ')}
                  </dd>
                </div>
              )}
            {assessment.topic_context && (
              <div className="col-span-2">
                <dt className="text-gray-400 mb-0.5">Class context</dt>
                <dd className="text-gray-700 leading-snug">{assessment.topic_context}</dd>
              </div>
            )}
            {assessment.system_prompt && (
              <div className="col-span-2">
                <dt className="text-gray-400 mb-0.5">AI instructions</dt>
                <dd className="text-gray-700 leading-snug">{assessment.system_prompt}</dd>
              </div>
            )}
          </dl>
        </div>
      </div>

      {/* Sessions */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-700">
            Sessions
            {sessions && sessions.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">{sessions.length} total</span>
            )}
          </h2>
        </div>

        {sessions && sessions.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Date</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Mode</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-5 py-3 text-left font-medium text-gray-500">Criterion A</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sessions.map((s) => {
                const ev = (s.evaluations as any)?.[0]
                const effectiveCriterionA = ev
                  ? (ev.teacher_override_level ?? ev.criterion_a_level)
                  : null
                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-gray-500 text-xs">
                      {s.started_at
                        ? new Date(s.started_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : '—'}
                    </td>
                    <td className="px-5 py-3 text-gray-600 capitalize">{s.mode}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-medium capitalize ${
                        s.status === 'completed' ? 'text-green-600' :
                        s.status === 'active'    ? 'text-blue-600' : 'text-gray-400'
                      }`}>
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-600">
                      {ev ? `${effectiveCriterionA ?? '—'}/8` : '—'}
                      {ev?.teacher_override_level !== null && (
                        <span className="ml-2 text-[11px] font-medium text-indigo-700">override</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      {ev && (
                        <Link
                          href={`/reports/evaluation/${ev.id}`}
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                        >
                          <ExternalLink size={12} />
                          Report
                        </Link>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12 text-gray-400 text-sm">
            No sessions yet.{status === 'draft' && ' Activate the assessment to allow students to join.'}
            {status === 'active' && ' Share the access code with students to start.'}
          </div>
        )}
      </div>

      {(assessment as any).assessment_mode === 'multimodal' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mt-6">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              Learning Materials
              {materials && materials.length > 0 && (
                <span className="ml-2 text-xs font-normal text-gray-400">{materials.length} total</span>
              )}
            </h2>
          </div>
          {materialsError ? (
            <div className="px-5 py-4 text-sm text-amber-700 bg-amber-50">
              Could not load learning materials. Run multimodal migration `003_multimodal_assessment_foundation.sql`.
            </div>
          ) : materials && materials.length > 0 ? (
            <ul className="divide-y divide-gray-50">
              {materials.map((m) => (
                <li key={m.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{m.title}</p>
                    <p className="text-xs text-gray-500">{m.type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        'px-2 py-0.5 text-xs rounded-full',
                        m.processing_status === 'ready'
                          ? 'bg-green-100 text-green-700'
                          : m.processing_status === 'error'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700',
                      ].join(' ')}
                    >
                      {m.processing_status}
                    </span>
                    <span className="text-xs text-gray-500">
                      {m.show_during_assessment ? 'Shown in session' : 'Hidden'}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-5 text-sm text-gray-500">No learning materials yet.</div>
          )}
        </div>
      )}

      <div className="mt-6">
        <TypingPermissions assessmentId={assessment.id} />
      </div>
    </div>
  )
}
