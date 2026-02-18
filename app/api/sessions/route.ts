import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { access_code, student_name } = body

    if (!access_code || !student_name) {
      return NextResponse.json({ error: 'Access code and name are required' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Validate access code → find active assessment
    const { data: assessment, error: assessmentError } = await supabase
      .from('assessments')
      .select('id, allow_group, max_group_size, max_questions')
      .eq('access_code', access_code.toUpperCase())
      .eq('status', 'active')
      .single()

    if (assessmentError || !assessment) {
      return NextResponse.json(
        { error: 'Invalid or expired access code' },
        { status: 404 }
      )
    }

    // Anonymous student flow: participants can be created without auth users.
    // `session_participants.student_id` is nullable in schema.
    const studentId = null

    // Group mode: look for a waiting session with available slots
    let sessionId: string
    let participantId: string

    if (assessment.allow_group) {
      const { data: waitingSession } = await supabase
        .from('sessions')
        .select('id, session_participants(count)')
        .eq('assessment_id', assessment.id)
        .eq('status', 'waiting')
        .single()

      const currentCount = (waitingSession?.session_participants as any)?.[0]?.count ?? 0

      if (waitingSession && currentCount < (assessment.max_group_size ?? 4)) {
        sessionId = waitingSession.id
      } else {
        const { data: newSession, error: newSessionError } = await supabase
          .from('sessions')
          .insert({
            assessment_id: assessment.id,
            mode: 'group',
            status: 'waiting',
          })
          .select('id')
          .single()
        if (newSessionError || !newSession) {
          console.error('[/api/sessions] create group session failed', newSessionError)
          return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
        }
        sessionId = newSession.id
      }
    } else {
      // Individual mode: always create a new session
      const { data: newSession, error: newSessionError } = await supabase
        .from('sessions')
        .insert({
          assessment_id: assessment.id,
          mode: 'individual',
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (newSessionError || !newSession) {
        console.error('[/api/sessions] create individual session failed', newSessionError)
        return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
      }
      sessionId = newSession.id
    }

    // Add participant to session
    const { data: participant, error: participantError } = await supabase
      .from('session_participants')
      .insert({
        session_id: sessionId,
        student_id: studentId,
        student_name: student_name,
        allow_text_input: false,
        joined_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (participantError || !participant) {
      console.error('[/api/sessions] create participant failed', participantError)
      return NextResponse.json({ error: 'Failed to join session' }, { status: 500 })
    }

    participantId = participant.id

    return NextResponse.json({ session_id: sessionId, participant_id: participantId })
  } catch (err) {
    console.error('[/api/sessions]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
