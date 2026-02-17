import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { access_code, student_name } = body

    if (!access_code || !student_name) {
      return NextResponse.json({ error: 'Access code and name are required' }, { status: 400 })
    }

    const supabase = await createClient()

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

    // Create or retrieve a student profile (name-based, no auth)
    // For MVP, we create an anonymous profile entry
    const { data: studentProfile } = await supabase
      .from('profiles')
      .insert({
        full_name: student_name,
        role: 'student',
        email: `${Date.now()}-${Math.random().toString(36).slice(2)}@anonymous.voiceiq`,
      })
      .select('id')
      .single()

    const studentId = studentProfile?.id ?? null

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
        const { data: newSession } = await supabase
          .from('sessions')
          .insert({
            assessment_id: assessment.id,
            mode: 'group',
            status: 'waiting',
          })
          .select('id')
          .single()
        sessionId = newSession!.id
      }
    } else {
      // Individual mode: always create a new session
      const { data: newSession } = await supabase
        .from('sessions')
        .insert({
          assessment_id: assessment.id,
          mode: 'individual',
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      sessionId = newSession!.id
    }

    // Add participant to session
    const { data: participant } = await supabase
      .from('session_participants')
      .insert({
        session_id: sessionId,
        student_id: studentId,
        joined_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    participantId = participant!.id

    return NextResponse.json({ session_id: sessionId, participant_id: participantId })
  } catch (err) {
    console.error('[/api/sessions]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
