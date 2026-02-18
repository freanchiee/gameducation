import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const participantId = params.id
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    const admin = createAdminClient()
    const { data: participant, error } = await admin
      .from('session_participants')
      .select('id, session_id, allow_text_input')
      .eq('id', participantId)
      .single()

    if (error || !participant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    if (sessionId && participant.session_id !== sessionId) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    return NextResponse.json({ allow_text_input: participant.allow_text_input })
  } catch (err) {
    console.error('[/api/participants/[id]/typing GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const participantId = params.id
    const body = await request.json()
    const allowTextInput = Boolean(body.allow_text_input)

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: ownedParticipant, error: ownershipError } = await supabase
      .from('session_participants')
      .select('id, sessions!inner(assessments!inner(classes!inner(teacher_id)))')
      .eq('id', participantId)
      .single()

    if (ownershipError || !ownedParticipant) {
      return NextResponse.json({ error: 'Participant not found' }, { status: 404 })
    }

    const teacherId = (((ownedParticipant as any).sessions as any).assessments as any).classes
      .teacher_id

    if (teacherId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient()
    const { error: updateError } = await admin
      .from('session_participants')
      .update({ allow_text_input: allowTextInput })
      .eq('id', participantId)

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update permission' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, allow_text_input: allowTextInput })
  } catch (err) {
    console.error('[/api/participants/[id]/typing POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
