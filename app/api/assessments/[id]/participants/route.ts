import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

    const admin = createAdminClient()

    const { data: sessions, error: sessionsError } = await admin
      .from('sessions')
      .select('id, status')
      .eq('assessment_id', assessmentId)

    if (sessionsError) {
      return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 })
    }

    if (!sessions || sessions.length === 0) {
      return NextResponse.json({ participants: [] })
    }

    const sessionStatusMap = new Map(sessions.map((s) => [s.id, s.status]))
    const sessionIds = sessions.map((s) => s.id)

    const { data: participants, error: participantsError } = await admin
      .from('session_participants')
      .select('id, session_id, student_name, allow_text_input, joined_at')
      .in('session_id', sessionIds)
      .order('joined_at', { ascending: false })

    // Backward-compatible fallback when new columns are missing.
    const missingColumnError =
      participantsError &&
      ((participantsError as any).code === 'PGRST204' ||
        /column .* does not exist/i.test(participantsError.message ?? '') ||
        /could not find .* column/i.test(participantsError.message ?? ''))

    if (missingColumnError) {
      const legacyParticipants = await admin
        .from('session_participants')
        .select('id, session_id, joined_at')
        .in('session_id', sessionIds)
        .order('joined_at', { ascending: false })

      if (legacyParticipants.error) {
        return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 })
      }

      const normalizedLegacy = (legacyParticipants.data ?? []).map((p) => ({
        id: p.id,
        session_id: p.session_id,
        student_name: null,
        allow_text_input: false,
        joined_at: p.joined_at,
        sessions: {
          status: sessionStatusMap.get(p.session_id) ?? 'active',
        },
      }))

      return NextResponse.json({ participants: normalizedLegacy })
    }

    if (participantsError) {
      return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 })
    }

    const normalized = (participants ?? []).map((p) => ({
      ...p,
      sessions: {
        status: sessionStatusMap.get(p.session_id) ?? 'active',
      },
    }))

    return NextResponse.json({ participants: normalized })
  } catch (err) {
    console.error('[/api/assessments/[id]/participants]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
