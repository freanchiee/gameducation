import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, PlusCircle, Clock, PlayCircle, CheckCircle } from 'lucide-react'
import { AssessmentStatus } from '@/lib/types'

const STATUS_CONFIG: Record<AssessmentStatus, { label: string; color: string }> = {
  draft:  { label: 'Draft',  color: 'bg-gray-100 text-gray-600' },
  active: { label: 'Active', color: 'bg-green-100 text-green-700' },
  closed: { label: 'Closed', color: 'bg-blue-100 text-blue-700' },
}

export default async function ClassDetailPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: cls } = await supabase
    .from('classes')
    .select('*')
    .eq('id', params.id)
    .eq('teacher_id', user!.id)
    .single()

  if (!cls) notFound()

  const { data: assessments } = await supabase
    .from('assessments')
    .select('id, title, topic, status, access_code, max_questions, criteria, created_at')
    .eq('class_id', params.id)
    .order('created_at', { ascending: false })

  const { data: enrolments } = await supabase
    .from('class_enrolments')
    .select('count')
    .eq('class_id', params.id)
    .single()

  const studentCount = (enrolments as any)?.count ?? 0

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="flex items-start gap-3 mb-8">
        <Link href="/classes" className="text-gray-400 hover:text-gray-600 transition-colors mt-1">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">{cls.name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {cls.programme} · {cls.year_group} · {cls.subject}
            {studentCount > 0 && ` · ${studentCount} student${studentCount !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Link
          href={`/assessments/new`}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <PlusCircle size={16} />
          New Assessment
        </Link>
      </div>

      {/* Class info card */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Class Details</h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt className="text-gray-400">Programme</dt>
            <dd className="font-medium text-gray-900">{cls.programme}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Year group</dt>
            <dd className="font-medium text-gray-900">{cls.year_group}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Subject</dt>
            <dd className="font-medium text-gray-900">{cls.subject}</dd>
          </div>
          <div>
            <dt className="text-gray-400">Created</dt>
            <dd className="font-medium text-gray-900">
              {new Date(cls.created_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </dd>
          </div>
        </dl>
      </div>

      {/* Assessments */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-gray-700">
            Assessments
            {assessments && assessments.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-400">{assessments.length} total</span>
            )}
          </h2>
        </div>

        {assessments && assessments.length > 0 ? (
          <div className="space-y-3">
            {assessments.map((a) => {
              const statusConf = STATUS_CONFIG[a.status as AssessmentStatus]
              return (
                <Link
                  key={a.id}
                  href={`/assessments/${a.id}`}
                  className="flex items-center justify-between p-5 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
                >
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900">{a.title}</h3>
                      <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusConf.color}`}>
                        {statusConf.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      {a.topic} · {a.max_questions} questions ·{' '}
                      Criteria {(a.criteria as string[]).join(', ')}
                    </p>
                  </div>
                  {a.status === 'active' && (
                    <div className="flex items-center gap-2 text-sm font-mono text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg shrink-0">
                      <span className="text-xs text-blue-500 uppercase tracking-wider">Code</span>
                      <span className="font-bold text-lg tracking-widest">{a.access_code}</span>
                    </div>
                  )}
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="text-center py-14 bg-white rounded-xl border border-dashed border-gray-300">
            <h3 className="text-base font-medium text-gray-900 mb-2">No assessments yet</h3>
            <p className="text-gray-500 text-sm mb-5">
              Create an oral assessment for {cls.name}.
            </p>
            <Link
              href="/assessments/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
            >
              <PlusCircle size={16} />
              Create assessment
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
