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
      id, criterion_a_level, criterion_b_level, criterion_c_level, criterion_d_level, teacher_override_level,
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
        <h1 className="text-3xl font-bold text-[#223a83]">Reports</h1>
        <p className="text-[#516079] mt-1">Review AI-generated evaluation results</p>
      </div>

      {evaluations && evaluations.length > 0 ? (
        <div className="gd-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[#ece6bf] border-b border-[#c9be86]">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-[#223a83]">Student</th>
                <th className="px-4 py-3 text-left font-medium text-[#223a83]">Assessment</th>
                <th className="px-4 py-3 text-left font-medium text-[#223a83]">Criterion A</th>
                <th className="px-4 py-3 text-left font-medium text-[#223a83]">Status</th>
                <th className="px-4 py-3 text-left font-medium text-[#223a83]">Date</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-[#d8deea]">
              {evaluations.map((ev) => {
                const effectiveCriterionA = ev.teacher_override_level ?? ev.criterion_a_level ?? 0
                const band = getLevelBand(effectiveCriterionA)
                const assessment = (ev.sessions as any)?.assessments
                const student = (ev.profiles as any)?.full_name ?? 'Unknown student'
                return (
                  <tr key={ev.id} className="hover:bg-[#eff4f8] transition-colors">
                    <td className="px-4 py-3 font-medium text-[#223a83]">{student}</td>
                    <td className="px-4 py-3 text-[#44597f]">
                      {assessment?.title ?? '—'}
                      <span className="ml-2 text-xs text-[#687891]">{assessment?.topic}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${band.color}`}>
                        {effectiveCriterionA}/8 · {band.label}
                      </span>
                      {ev.teacher_override_level !== null && (
                        <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-medium bg-indigo-100 text-indigo-700">
                          Teacher override
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {ev.reviewed_by_teacher ? (
                        <span className="text-xs text-green-600 font-medium">Reviewed</span>
                      ) : (
                        <span className="text-xs text-amber-600 font-medium">Needs review</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[#687891] text-xs">
                      {new Date(ev.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/reports/evaluation/${ev.id}`}
                        className="flex items-center gap-1 text-[#24408f] hover:text-[#1b3272] text-xs font-medium"
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
        <div className="text-center py-16 gd-surface border-dashed border-[#b7c2d4]">
          <FileText size={40} className="mx-auto text-[#7c89a4] mb-4" />
          <h3 className="text-lg font-medium text-[#223a83] mb-2">No evaluations yet</h3>
          <p className="text-[#516079]">Completed student assessments will appear here.</p>
        </div>
      )}
    </div>
  )
}
