import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import NewAssessmentForm from '@/components/teacher/NewAssessmentForm'
import { Assessment, Class } from '@/lib/types'

export default async function EditAssessmentPage({
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
    .select('*, classes(teacher_id)')
    .eq('id', params.id)
    .single()

  if (!assessment) notFound()
  if ((assessment.classes as any)?.teacher_id !== user?.id) notFound()

  const { data: classes } = await supabase
    .from('classes')
    .select('*')
    .eq('teacher_id', user!.id)
    .order('created_at', { ascending: false })

  const { data: materials } = await supabase
    .from('learning_materials')
    .select('id, title, type, material_data, extracted_text, storage_path, original_filename, file_size_bytes')
    .eq('assessment_id', params.id)
    .order('display_order', { ascending: true })

  return (
    <div className="w-full">
      <div className="flex items-center gap-3 mb-8">
        <Link href={`/assessments/${params.id}`} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Edit Assessment</h1>
          <p className="text-gray-500 mt-0.5 text-sm">Update multimodal settings, resources, and task behavior.</p>
        </div>
      </div>

      <NewAssessmentForm
        mode="edit"
        assessmentId={params.id}
        classes={(classes ?? []) as Class[]}
        initialAssessment={assessment as Assessment}
        initialMaterials={(materials ?? []) as Array<{
          id: string
          title: string
          type: string
          material_data: Record<string, unknown> | null
          extracted_text: string | null
          storage_path?: string | null
          original_filename?: string | null
          file_size_bytes?: number | null
        }>}
      />
    </div>
  )
}
