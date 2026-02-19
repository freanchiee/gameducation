import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id
    const { searchParams } = new URL(request.url)
    const participantId = searchParams.get('participant_id')

    if (!sessionId || !participantId) {
      return NextResponse.json({ error: 'Missing required query params' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: participant, error: participantError } = await supabase
      .from('session_participants')
      .select('id')
      .eq('id', participantId)
      .eq('session_id', sessionId)
      .single()

    if (participantError || !participant) {
      return NextResponse.json({ error: 'Participant not found in session' }, { status: 403 })
    }

    let { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('assessment_id, assessments(assessment_mode)')
      .eq('id', sessionId)
      .single()

    if (sessionError && /assessment_mode|PGRST204|column/i.test(sessionError.message ?? '')) {
      const fallback = await supabase
        .from('sessions')
        .select('assessment_id, assessments(id)')
        .eq('id', sessionId)
        .single()
      session = fallback.data as typeof session
      sessionError = fallback.error
    }

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const mode = ((session.assessments as any)?.assessment_mode ?? 'voice') as 'voice' | 'multimodal'
    if (mode !== 'multimodal') {
      return NextResponse.json({ assessment_mode: mode, materials: [] })
    }

    const { data: materials, error: materialsError } = await supabase
      .from('learning_materials')
      .select('id, title, type, extracted_text, material_data, media_urls, storage_path')
      .eq('assessment_id', session.assessment_id)
      .eq('show_during_assessment', true)
      .order('display_order', { ascending: true })
      .limit(50)

    if (materialsError) {
      return NextResponse.json({ error: 'Failed to load materials' }, { status: 500 })
    }

    const enriched = await Promise.all(
      (materials ?? []).map(async (m: any) => {
        let signedUrl: string | null = null
        if (m.storage_path) {
          const { data } = await supabase.storage
            .from('learning-materials')
            .createSignedUrl(m.storage_path, 60 * 60)
          signedUrl = data?.signedUrl ?? null
        }
        return {
          id: m.id,
          title: m.title,
          type: m.type,
          extracted_text: m.extracted_text,
          material_data: m.material_data ?? {},
          media_urls: Array.isArray(m.media_urls) ? m.media_urls : [],
          signed_url: signedUrl,
        }
      })
    )

    return NextResponse.json({
      assessment_mode: mode,
      materials: enriched,
    })
  } catch (error) {
    console.error('[/api/sessions/[id]/materials] error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
