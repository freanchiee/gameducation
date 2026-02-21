import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MIGRATION_HINT, isMissingColumnError } from '@/lib/multimodal/runtime'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const sessionId = String(body?.session_id ?? '')
    const participantId = String(body?.participant_id ?? '')
    const taskRunId = String(body?.task_run_id ?? '')
    const events: Array<{ event_type: string; event_data?: Record<string, unknown>; timestamp?: string }> =
      Array.isArray(body?.events) ? body.events : []

    if (!sessionId || !participantId) {
      return NextResponse.json(
        { error: 'session_id and participant_id are required' },
        { status: 400 }
      )
    }

    if (events.length === 0) {
      return NextResponse.json({ inserted: 0 })
    }

    // Cap batch size to prevent abuse
    const batch = events.slice(0, 200)

    const supabase = createAdminClient()

    const rows = batch.map((e) => ({
      task_run_id: taskRunId || null,
      session_id: sessionId,
      participant_id: participantId,
      event_type: String(e.event_type ?? 'unknown'),
      event_data: e.event_data ?? {},
      timestamp: e.timestamp ?? new Date().toISOString(),
    }))

    const { error } = await supabase.from('task_events').insert(rows)

    if (error) {
      if (isMissingColumnError(error)) throw new Error(MIGRATION_HINT)
      throw new Error('Failed to insert event batch')
    }

    return NextResponse.json({ inserted: rows.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message.includes(MIGRATION_HINT) ? 500 : 500
    return NextResponse.json(
      { error: message.includes(MIGRATION_HINT) ? MIGRATION_HINT : message },
      { status }
    )
  }
}
