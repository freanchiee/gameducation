import { createClient } from '@/lib/supabase/server'
import AssessmentsGallery from '@/components/teacher/AssessmentsGallery'

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

  const { data: drafts, error: draftsError } = await supabase
    .from('assessment_drafts')
    .select('id, title, topic, mode, updated_at')
    .order('updated_at', { ascending: false })
    .limit(24)

  const safeDrafts =
    draftsError && /assessment_drafts|does not exist|PGRST/i.test(draftsError.message ?? '')
      ? []
      : (drafts ?? [])

  return <AssessmentsGallery assessments={(assessments ?? []) as any[]} drafts={safeDrafts as any[]} />
}
