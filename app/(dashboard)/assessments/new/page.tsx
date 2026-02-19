import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import NewAssessmentForm from '@/components/teacher/NewAssessmentForm'
import { Class } from '@/lib/types'

export default async function NewAssessmentPage({
  searchParams,
}: {
  searchParams?: { draft?: string }
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: classes } = await supabase
    .from('classes')
    .select('*')
    .eq('teacher_id', user!.id)
    .order('created_at', { ascending: false })

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/assessments" className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">New Assessment</h1>
          <p className="text-gray-500 mt-0.5 text-sm">
            Choose Standard or Multimodal mode, then configure your assessment
          </p>
        </div>
      </div>

      <NewAssessmentForm
        classes={(classes ?? []) as Class[]}
        initialServerDraftId={searchParams?.draft}
      />
    </div>
  )
}
