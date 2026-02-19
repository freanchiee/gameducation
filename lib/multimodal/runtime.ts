import {
  aggregateCriterionScore,
  buildTaskConfig,
  computeSubmissionSignals,
  mapUiTaskTypeToCanonical,
  selectNextTaskDecision,
  type EvidencePoint,
  type EngineCriterion,
} from '@/lib/multimodal/engine'

const MIGRATION_HINT = 'Database migration missing. Run migration 006_multimodal_part2_runtime.sql first.'

export function isMissingColumnError(error: any) {
  if (!error) return false
  return (
    error.code === 'PGRST204' ||
    /column .* does not exist/i.test(error.message ?? '') ||
    /could not find .* column/i.test(error.message ?? '') ||
    /relation .* does not exist/i.test(error.message ?? '')
  )
}

export type RuntimeContext = {
  sessionId: string
  participantId: string
  studentId: string | null
  assessmentId: string
  topic: string
  criteria: EngineCriterion[]
  maxQuestions: number
  enabledTaskTypes: string[]
  preferredSimulationUrl: string | null
}

export async function resolveRuntimeContext(supabase: any, sessionId: string, participantId: string): Promise<RuntimeContext> {
  const { data: participant, error: participantError } = await supabase
    .from('session_participants')
    .select('id, session_id, student_id')
    .eq('id', participantId)
    .eq('session_id', sessionId)
    .single()

  if (participantError || !participant) {
    throw new Error('Participant not found in session')
  }

  let { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, status, assessment_id, assessments(id, topic, max_questions, criteria, assessment_mode, multimodal_task_types)')
    .eq('id', sessionId)
    .single()

  if (sessionError && isMissingColumnError(sessionError)) {
    throw new Error(MIGRATION_HINT)
  }

  if (sessionError || !session) {
    throw new Error('Session not found')
  }

  const assessment = (session as any).assessments
  if (!assessment) {
    throw new Error('Assessment not found for session')
  }
  if (assessment.assessment_mode !== 'multimodal') {
    throw new Error('This endpoint only supports multimodal assessments')
  }

  const { data: materials } = await supabase
    .from('learning_materials')
    .select('material_data, media_urls, type, title')
    .eq('assessment_id', assessment.id)
    .eq('show_during_assessment', true)
    .order('display_order', { ascending: true })

  const sim = (materials ?? []).find((m: any) => {
    const kind = typeof m.material_data?.kind === 'string' ? m.material_data.kind : ''
    return kind === 'simulation' || /simulation|geogebra|phet/i.test(`${m.type} ${m.title}`)
  }) as any

  const preferredSimulationUrl =
    (typeof sim?.material_data?.embed_url === 'string' && sim.material_data.embed_url) ||
    (typeof sim?.material_data?.url === 'string' && sim.material_data.url) ||
    (Array.isArray(sim?.media_urls) && typeof sim.media_urls[0] === 'string' ? sim.media_urls[0] : null)

  return {
    sessionId,
    participantId,
    studentId: participant.student_id ?? null,
    assessmentId: assessment.id,
    topic: assessment.topic,
    criteria: Array.isArray(assessment.criteria) ? (assessment.criteria as EngineCriterion[]) : ['B', 'C'],
    maxQuestions: Number(assessment.max_questions ?? 8),
    enabledTaskTypes: Array.isArray(assessment.multimodal_task_types) ? assessment.multimodal_task_types : [],
    preferredSimulationUrl,
  }
}

export async function loadEvidenceForParticipant(supabase: any, participantId: string): Promise<EvidencePoint[]> {
  const { data, error } = await supabase
    .from('rubric_evidence')
    .select('criterion, evidence_value, indicated_level, weight')
    .eq('participant_id', participantId)
    .order('created_at', { ascending: true })

  if (error) {
    if (isMissingColumnError(error)) throw new Error(MIGRATION_HINT)
    throw new Error('Failed to load rubric evidence')
  }

  return (data ?? []).map((row: any) => {
    const payload = row.evidence_value ?? {}
    return {
      criterion: (row.criterion ?? payload.criterion ?? 'B') as EngineCriterion,
      taskType: mapUiTaskTypeToCanonical(payload.task_type_ui ?? payload.task_type),
      difficulty: Number(payload.difficulty_level ?? 5),
      correctness: Number(payload.correctness ?? 0),
      indicatedLevel: Number(row.indicated_level ?? payload.indicated_level ?? 1),
      weight: Number(row.weight ?? payload.weight ?? 1),
    }
  })
}

export async function ensureTaskTemplate(supabase: any, args: {
  criterion: EngineCriterion
  taskType: string
  taskTypeUi: string
  difficulty: number
  topic: string
  simulationUrl?: string | null
}) {
  const canonical = mapUiTaskTypeToCanonical(args.taskType)
  const taskConfig = buildTaskConfig({
    taskType: canonical,
    taskTypeUi: args.taskTypeUi,
    criterion: args.criterion,
    difficulty: args.difficulty,
    topic: args.topic,
    simulationUrl: args.simulationUrl,
  })

  const title = `${args.topic} • ${canonical.replaceAll('_', ' ')}`

  const { data: existing } = await supabase
    .from('multimodal_tasks')
    .select('id')
    .eq('task_type', canonical)
    .eq('criterion', args.criterion)
    .eq('difficulty_level', args.difficulty)
    .limit(1)
    .maybeSingle()

  if (existing?.id) {
    return { taskId: existing.id as string, taskConfig }
  }

  const { data, error } = await supabase
    .from('multimodal_tasks')
    .insert({
      title,
      task_type: canonical,
      criterion: args.criterion,
      difficulty_level: args.difficulty,
      config: taskConfig,
      estimated_duration_seconds: 300,
    })
    .select('id')
    .single()

  if (error || !data) {
    if (isMissingColumnError(error)) throw new Error(MIGRATION_HINT)
    throw new Error('Failed to create multimodal task template')
  }

  return { taskId: data.id as string, taskConfig }
}

export async function ensureActiveTaskRun(supabase: any, context: RuntimeContext) {
  const evidence = await loadEvidenceForParticipant(supabase, context.participantId)
  const decision = selectNextTaskDecision(evidence, {
    criteria: context.criteria,
    enabledTaskTypes: context.enabledTaskTypes,
    maxTasks: context.maxQuestions,
  })

  if (decision.action !== 'present_task' || !decision.nextTask) {
    return { decision, taskRun: null }
  }

  const existing = await supabase
    .from('session_task_runs')
    .select('id, task_sequence, criterion, status, task_config, task_id')
    .eq('participant_id', context.participantId)
    .in('status', ['pending', 'in_progress'])
    .order('task_sequence', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing.error && isMissingColumnError(existing.error)) {
    throw new Error(MIGRATION_HINT)
  }
  if (existing.data) {
    return {
      decision,
      taskRun: {
        id: existing.data.id,
        task_sequence: existing.data.task_sequence,
        criterion: existing.data.criterion,
        status: existing.data.status,
        task_config: existing.data.task_config,
        task_id: existing.data.task_id,
      },
    }
  }

  const sequenceRes = await supabase
    .from('session_task_runs')
    .select('task_sequence')
    .eq('participant_id', context.participantId)
    .order('task_sequence', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sequenceRes.error && isMissingColumnError(sequenceRes.error)) {
    throw new Error(MIGRATION_HINT)
  }

  const nextSequence = Number(sequenceRes.data?.task_sequence ?? 0) + 1
  const { taskId, taskConfig } = await ensureTaskTemplate(supabase, {
    criterion: decision.nextTask.criterion,
    taskType: decision.nextTask.taskType,
    taskTypeUi: decision.nextTask.taskTypeUi,
    difficulty: decision.nextTask.difficulty,
    topic: context.topic,
    simulationUrl: context.preferredSimulationUrl,
  })

  const insert = await supabase
    .from('session_task_runs')
    .insert({
      session_id: context.sessionId,
      task_id: taskId,
      participant_id: context.participantId,
      student_id: context.studentId,
      criterion: decision.nextTask.criterion,
      task_sequence: nextSequence,
      status: 'in_progress',
      task_config: taskConfig,
      started_at: new Date().toISOString(),
    })
    .select('id, task_sequence, criterion, status, task_config, task_id')
    .single()

  if (insert.error || !insert.data) {
    if (isMissingColumnError(insert.error)) throw new Error(MIGRATION_HINT)
    throw new Error('Failed to create task run')
  }

  return {
    decision,
    taskRun: insert.data,
  }
}

export async function finalizeTaskSubmission(supabase: any, args: {
  context: RuntimeContext
  taskRunId: string
  submissionData: any
}) {
  const { context, taskRunId, submissionData } = args

  const runRes = await supabase
    .from('session_task_runs')
    .select('id, participant_id, criterion, status, task_config')
    .eq('id', taskRunId)
    .eq('participant_id', context.participantId)
    .single()

  if (runRes.error || !runRes.data) {
    throw new Error('Task run not found')
  }

  const run = runRes.data as any
  if (run.status === 'submitted') {
    return { alreadySubmitted: true }
  }

  const metrics = computeSubmissionSignals(submissionData, run.task_config ?? {})

  const mergedSubmission = {
    ...(submissionData ?? {}),
    metrics,
    criterion: run.criterion,
    task_type: run.task_config?.task_type,
    task_type_ui: run.task_config?.task_type_ui,
    difficulty_level: run.task_config?.difficulty_level,
  }

  const updateRes = await supabase
    .from('session_task_runs')
    .update({
      status: 'submitted',
      submission_data: mergedSubmission,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', taskRunId)

  if (updateRes.error) {
    if (isMissingColumnError(updateRes.error)) throw new Error(MIGRATION_HINT)
    throw new Error('Failed to update task run')
  }

  const evidenceInsert = await supabase
    .from('rubric_evidence')
    .insert({
      session_id: context.sessionId,
      participant_id: context.participantId,
      student_id: context.studentId,
      task_run_id: taskRunId,
      criterion: run.criterion,
      evidence_type: 'task_submission',
      indicated_level: metrics.indicated_level,
      weight: 1,
      evidence_value: {
        criterion: run.criterion,
        ...metrics,
        task_type: run.task_config?.task_type,
        task_type_ui: run.task_config?.task_type_ui,
        difficulty_level: run.task_config?.difficulty_level,
      },
    })

  if (evidenceInsert.error) {
    if (isMissingColumnError(evidenceInsert.error)) throw new Error(MIGRATION_HINT)
    throw new Error('Failed to record rubric evidence')
  }

  const evidence = await loadEvidenceForParticipant(supabase, context.participantId)
  const decision = selectNextTaskDecision(evidence, {
    criteria: context.criteria,
    enabledTaskTypes: context.enabledTaskTypes,
    maxTasks: context.maxQuestions,
  })

  return {
    alreadySubmitted: false,
    metrics,
    decision,
    evidence,
  }
}

export async function saveFinalScores(supabase: any, context: RuntimeContext, evidence: EvidencePoint[]) {
  const criteria = context.criteria.length > 0 ? context.criteria : (['B', 'C'] as EngineCriterion[])

  for (const criterion of criteria) {
    const score = aggregateCriterionScore(criterion, evidence, context.enabledTaskTypes)
    const { error } = await supabase
      .from('scoring_decisions')
      .upsert({
        session_id: context.sessionId,
        participant_id: context.participantId,
        student_id: context.studentId,
        criterion,
        rubric_level: score.rubric_level,
        rubric_level_band: score.rubric_level_band,
        justification: score.justification,
        evidence_summary: score.evidence_summary,
        confidence_score: score.confidence_score,
      }, { onConflict: 'participant_id,criterion' })

    if (error) {
      if (isMissingColumnError(error)) throw new Error(MIGRATION_HINT)
      throw new Error('Failed to persist scoring decisions')
    }
  }
}

export { MIGRATION_HINT }
