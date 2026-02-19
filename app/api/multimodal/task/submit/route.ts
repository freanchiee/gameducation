import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  MIGRATION_HINT,
  ensureActiveTaskRun,
  finalizeTaskSubmission,
  loadEvidenceForParticipant,
  resolveRuntimeContext,
  saveFinalScores,
} from '@/lib/multimodal/runtime'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const sessionId = String(body?.session_id ?? '')
    const participantId = String(body?.participant_id ?? '')
    const taskRunId = String(body?.task_run_id ?? '')
    const submissionData = body?.submission_data ?? {}

    if (!sessionId || !participantId || !taskRunId) {
      return NextResponse.json({ error: 'session_id, participant_id, and task_run_id are required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const context = await resolveRuntimeContext(supabase, sessionId, participantId)

    const result = await finalizeTaskSubmission(supabase, {
      context,
      taskRunId,
      submissionData,
    })

    const evidence = result.evidence ?? (await loadEvidenceForParticipant(supabase, participantId))

    if (result.decision?.action === 'finish_assessment') {
      await saveFinalScores(supabase, context, evidence)

      return NextResponse.json({
        action: 'finish_assessment',
        decision: result.decision,
        metrics: result.metrics ?? null,
        examiner_prompt: 'Great work. We now have enough multimodal evidence and will finalize your assessment.',
      })
    }

    const { decision, taskRun } = await ensureActiveTaskRun(supabase, context)

    return NextResponse.json({
      action: decision.action,
      decision,
      metrics: result.metrics ?? null,
      next_task_run: taskRun,
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
            context: 'Use this simulation as evidence for your response.',
          }
        : null,
      examiner_prompt: taskRun
        ? `Next task ready: ${taskRun.task_config?.title ?? 'Interactive task'}. Complete it and explain what you observe.`
        : 'Continue with examiner follow-up.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message.includes(MIGRATION_HINT) ? 500 : message.includes('not found') ? 404 : 500
    return NextResponse.json({ error: message.includes(MIGRATION_HINT) ? MIGRATION_HINT : message }, { status })
  }
}
