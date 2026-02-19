import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MIGRATION_HINT, ensureActiveTaskRun, resolveRuntimeContext } from '@/lib/multimodal/runtime'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const sessionId = String(body?.session_id ?? '')
    const participantId = String(body?.participant_id ?? '')

    if (!sessionId || !participantId) {
      return NextResponse.json({ error: 'session_id and participant_id are required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const context = await resolveRuntimeContext(supabase, sessionId, participantId)

    await supabase
      .from('sessions')
      .update({ status: 'active', started_at: new Date().toISOString() })
      .eq('id', sessionId)
      .in('status', ['waiting', 'active'])

    const { decision, taskRun } = await ensureActiveTaskRun(supabase, context)

    const examinerPrompt = taskRun
      ? `Use the on-screen task before answering. ${taskRun.task_config?.prompt ?? 'Complete the task and explain your reasoning.'}`
      : 'You have completed all required multimodal evidence tasks. Finalizing your assessment.'

    return NextResponse.json({
      action: decision.action,
      decision,
      task_run: taskRun,
      examiner_prompt: examinerPrompt,
      task_widget: taskRun
        ? {
            type: taskRun.task_config?.task_type_ui ?? 'short_answer',
            title: taskRun.task_config?.title ?? 'Interactive task',
            prompt: taskRun.task_config?.prompt ?? '',
          }
        : null,
      media_directive: taskRun?.task_config?.simulation_url
        ? {
            type: 'simulation',
            url: taskRun.task_config.simulation_url,
            context: 'Manipulate one variable, observe outcomes, then submit your evidence.',
          }
        : null,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message.includes(MIGRATION_HINT) ? 500 : message.includes('not found') ? 404 : 500
    return NextResponse.json({ error: message.includes(MIGRATION_HINT) ? MIGRATION_HINT : message }, { status })
  }
}
