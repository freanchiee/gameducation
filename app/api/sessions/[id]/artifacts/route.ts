import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const sessionId = params.id
    const formData = await request.formData()
    const participantId = String(formData.get('participant_id') ?? '')
    const file = formData.get('file')

    if (!sessionId || !participantId || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are supported' }, { status: 400 })
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

    const bytes = Buffer.from(await file.arrayBuffer())
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `session-artifacts/${sessionId}/${participantId}/${Date.now()}-${safe}`

    const { error: uploadError } = await supabase.storage
      .from('learning-materials')
      .upload(path, bytes, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const signed = await supabase.storage
      .from('learning-materials')
      .createSignedUrl(path, 60 * 60 * 24)

    if (signed.error || !signed.data?.signedUrl) {
      return NextResponse.json({ error: signed.error?.message ?? 'Could not sign artifact URL' }, { status: 500 })
    }

    return NextResponse.json({
      storage_path: path,
      signed_url: signed.data.signedUrl,
      file_name: file.name,
    })
  } catch (error) {
    console.error('[/api/sessions/[id]/artifacts] error', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
