import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const assessmentId = params.id

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('id, classes!inner(teacher_id)')
      .eq('id', assessmentId)
      .single()

    if (assessmentError || !assessment) {
      return NextResponse.json({ error: 'Assessment not found' }, { status: 404 })
    }

    if (((assessment as any).classes as any).teacher_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: participants, error: participantsError } = await supabase
      .from('session_participants')
      .select('id, session_id, student_name, allow_text_input, joined_at, sessions!inner(assessment_id, status)')
      .eq('sessions.assessment_id', assessmentId)
      .order('joined_at', { ascending: false })

    if (participantsError) {
      return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 })
    }

    return NextResponse.json({ participants: participants ?? [] })
  } catch (err) {
    console.error('[/api/assessments/[id]/participants]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
