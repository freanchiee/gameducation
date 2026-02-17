import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PlusCircle, PlayCircle, Clock, CheckCircle } from 'lucide-react'

const STATUS_CONFIG = {
  draft: { label: 'Draft', icon: Clock, color: 'bg-gray-100 text-gray-700' },
  active: { label: 'Active', icon: PlayCircle, color: 'bg-green-100 text-green-700' },
  closed: { label: 'Closed', icon: CheckCircle, color: 'bg-blue-100 text-blue-700' },
} as const

export default async function AssessmentsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: assessments } = await supabase
    .from('assessments')
    .select('*, classes(name, year_group, programme)')
    .eq('classes.teacher_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assessments</h1>
          <p className="text-gray-500 mt-1">Build and manage oral assessments</p>
        </div>
        <Link
          href="/assessments/new"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-sm"
        >
          <PlusCircle size={16} />
          New Assessment
        </Link>
      </div>

      {assessments && assessments.length > 0 ? (
        <div className="space-y-3">
          {assessments.map((a) => {
            const status = STATUS_CONFIG[a.status as keyof typeof STATUS_CONFIG]
            return (
              <Link
                key={a.id}
                href={`/assessments/${a.id}`}
                className="flex items-center justify-between p-5 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-gray-900">{a.title}</h3>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500">
                    {a.classes?.name} · {a.topic} · {a.max_questions} questions
                  </p>
                </div>
                {a.status === 'active' && (
                  <div className="flex items-center gap-2 text-sm font-mono text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg">
                    <span className="text-xs text-blue-500 uppercase tracking-wider">Code</span>
                    <span className="font-bold text-lg tracking-widest">{a.access_code}</span>
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assessments yet</h3>
          <p className="text-gray-500 mb-6">
            Create an assessment to generate a student access code.
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
  )
}
