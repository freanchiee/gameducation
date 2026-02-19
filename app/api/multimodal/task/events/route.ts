import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MIGRATION_HINT, isMissingColumnError, resolveRuntimeContext } from '@/lib/multimodal/runtime'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const sessionId = String(body?.session_id ?? '')
    const participantId = String(body?.participant_id ?? '')
    const taskRunId = String(body?.task_run_id ?? '')
    const events = Array.isArray(body?.events) ? body.events : []

    if (!sessionId || !participantId || !taskRunId) {
      return NextResponse.json({ error: 'session_id, participant_id, and task_run_id are required' }, { status: 400 })
    }

    if (events.length === 0) {
      return NextResponse.json({ inserted: 0 })
    }

    const supabase = createAdminClient()
    await resolveRuntimeContext(supabase, sessionId, participantId)

    const runRes = await supabase
      .from('session_task_runs')
      .select('id')
      .eq('id', taskRunId)
      .eq('participant_id', participantId)
      .single()

    if (runRes.error || !runRes.data) {
      return NextResponse.json({ error: 'Task run not found' }, { status: 404 })
    }

    const rows = events
      .slice(0, 200)
      .map((event: any) => ({
        task_run_id: taskRunId,
        session_id: sessionId,
        participant_id: participantId,
        event_type: String(event?.event_type ?? event?.type ?? 'interaction'),
        event_data: typeof event?.event_data === 'object' && event?.event_data !== null ? event.event_data : { value: event?.value ?? null },
        timestamp: typeof event?.timestamp === 'string' ? event.timestamp : new Date().toISOString(),
      }))

    const insert = await supabase.from('task_events').insert(rows)

    if (insert.error) {
      if (isMissingColumnError(insert.error)) {
        return NextResponse.json({ error: MIGRATION_HINT }, { status: 500 })
      }
      return NextResponse.json({ error: insert.error.message }, { status: 500 })
    }

    return NextResponse.json({ inserted: rows.length })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message.includes(MIGRATION_HINT) ? MIGRATION_HINT : 'Internal server error' }, { status: 500 })
  }
}
