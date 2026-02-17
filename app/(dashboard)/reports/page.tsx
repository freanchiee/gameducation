import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FileText, ExternalLink } from 'lucide-react'

const LEVEL_BANDS = [
  { min: 0, max: 0, label: 'Not Assessed', color: 'bg-gray-100 text-gray-600' },
  { min: 1, max: 2, label: 'Limited', color: 'bg-red-100 text-red-700' },
  { min: 3, max: 4, label: 'Adequate', color: 'bg-yellow-100 text-yellow-700' },
  { min: 5, max: 6, label: 'Substantial', color: 'bg-blue-100 text-blue-700' },
  { min: 7, max: 8, label: 'Excellent', color: 'bg-green-100 text-green-700' },
]

function getLevelBand(level: number) {
  return LEVEL_BANDS.find((b) => level >= b.min && level <= b.max) ?? LEVEL_BANDS[0]
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: evaluations } = await supabase
    .from('evaluations')
    .select(
      `
      id, criterion_a_level, criterion_b_level, criterion_c_level, criterion_d_level,
      reviewed_by_teacher, created_at,
      sessions(
        assessments(title, topic, classes(teacher_id, name))
      ),
      profiles:student_id(full_name)
    `
    )
    .eq('sessions.assessments.classes.teacher_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(50)

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-500 mt-1">Review AI-generated evaluation results</p>
      </div>

      {evaluations && evaluations.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Student</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Assessment</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Criterion A</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {evaluations.map((ev) => {
                const band = getLevelBand(ev.criterion_a_level ?? 0)
                const assessment = (ev.sessions as any)?.assessments
                const student = (ev.profiles as any)?.full_name ?? 'Unknown student'
                return (
                  <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{student}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {assessment?.title ?? '—'}
                      <span className="ml-2 text-xs text-gray-400">{assessment?.topic}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${band.color}`}>
                        {ev.criterion_a_level}/8 · {band.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {ev.reviewed_by_teacher ? (
                        <span className="text-xs text-green-600 font-medium">Reviewed</span>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium">Needs review</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(ev.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/reports/evaluation/${ev.id}`}
                        className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium"
                      >
                        <ExternalLink size={12} />
                        Review
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-300">
          <FileText size={40} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No evaluations yet</h3>
          <p className="text-gray-500">Completed student assessments will appear here.</p>
        </div>
      )}
    </div>
  )
}
