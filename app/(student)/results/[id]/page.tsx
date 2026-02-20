import { createAdminClient } from '@/lib/supabase/admin'
import { CheckCircle } from 'lucide-react'
import ResultsCard from '@/components/assessment/ResultsCard'

export default async function ResultsPage({ params }: { params: { id: string } }) {
  const supabase = createAdminClient()

  const { data: evaluation } = await supabase
    .from('evaluations')
    .select(`
      *,
      sessions(assessments(title, topic, year_group))
    `)
    .eq('id', params.id)
    .single()

  if (!evaluation) {
    return (
      <div className="min-h-screen bg-[#ece8c7] py-10 px-4">
        <div className="max-w-2xl mx-auto gd-surface p-8 text-center">
          <h1 className="text-2xl font-bold text-[#223a83] mb-2">Assessment Complete</h1>
          <p className="text-[#516079]">
            Your evaluation is still being prepared. Please ask your teacher to refresh this page
            in a moment.
          </p>
        </div>
      </div>
    )
  }

  const assessment = (evaluation.sessions as any)?.assessments

  return (
    <div className="min-h-screen bg-[#ece8c7] py-10 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-[#223a83]">Assessment Complete</h1>
          {assessment && (
            <p className="text-[#516079] mt-1">
              {assessment.title} · {assessment.topic}
            </p>
          )}
        </div>

        {/* Results content */}
        <ResultsCard
          level={evaluation.criterion_a_level ?? 0}
          strengths={(evaluation.strengths as string[]) ?? []}
          areasForGrowth={(evaluation.areas_for_growth as string[]) ?? []}
          evidenceQuotes={(evaluation.evidence_quotes as string[]) ?? []}
          studentFeedback={evaluation.feedback_student ?? ''}
        />

        <p className="text-center text-xs text-[#8a95a9] pb-4">
          Your teacher has been notified of your completion.
        </p>
      </div>
    </div>
  )
}
