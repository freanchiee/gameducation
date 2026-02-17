import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { session_id, participant_id, role, content } = body

    if (!session_id || !role || !content) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('messages')
      .insert({
        session_id,
        participant_id: participant_id ?? null,
        role,
        content,
        timestamp: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) {
      return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 })
    }

    return NextResponse.json({ message_id: data.id })
  } catch (err) {
    console.error('[/api/transcripts]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('session_id')

    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 })
    }

    const supabase = await createClient()

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true })

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch transcript' }, { status: 500 })
    }

    return NextResponse.json({ messages })
  } catch (err) {
    console.error('[/api/transcripts GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
