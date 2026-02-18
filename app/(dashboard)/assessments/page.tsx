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
          <h1 className="text-3xl font-bold text-[#223a83]">Assessments</h1>
          <p className="text-[#516079] mt-1">Build and manage oral assessments</p>
        </div>
        <Link
          href="/assessments/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg gd-button font-medium text-sm"
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
                className="flex items-center justify-between p-5 gd-surface hover:border-[#7a8eb5] hover:shadow-md transition-all"
              >
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="font-semibold text-[#223a83]">{a.title}</h3>
                    <span
                      className={`px-2 py-0.5 text-xs font-medium rounded-full ${status.color}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  <p className="text-sm text-[#516079]">
                    {a.classes?.name} · {a.topic} · {a.max_questions} questions
                  </p>
                </div>
                {a.status === 'active' && (
                  <div className="flex items-center gap-2 text-sm font-mono text-[#24408f] bg-[#ece6bf] border border-[#c9be86] px-3 py-1.5 rounded-lg">
                    <span className="text-xs text-[#3f568f] uppercase tracking-wider">Code</span>
                    <span className="font-bold text-lg tracking-widest">{a.access_code}</span>
                  </div>
                )}
              </Link>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-16 gd-surface border-dashed border-[#b7c2d4]">
          <h3 className="text-lg font-medium text-[#223a83] mb-2">No assessments yet</h3>
          <p className="text-[#516079] mb-6">
            Create an assessment to generate a student access code.
          </p>
          <Link
            href="/assessments/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg gd-button font-medium text-sm"
          >
            <PlusCircle size={16} />
            Create assessment
          </Link>
        </div>
      )}
    </div>
  )
}
