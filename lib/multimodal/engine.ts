import type { AssessmentCriterion } from '@/lib/types'

export type EngineCriterion = AssessmentCriterion

export type CanonicalTaskType =
  | 'variable_sorter'
  | 'variable_matching'
  | 'simulation_data_collection'
  | 'graph_interpretation'
  | 'claim_evidence_reasoning'
  | 'error_analysis'
  | 'investigation_design'
  | 'reflection_evaluation'

export type OrchestratorAction = 'present_task' | 'voice_followup' | 'finish_assessment'

export type EvidencePoint = {
  criterion: EngineCriterion
  taskType: CanonicalTaskType
  difficulty: number
  correctness: number
  indicatedLevel: number
  weight: number
}

export type OrchestratorConfig = {
  criteria: EngineCriterion[]
  enabledTaskTypes: string[]
  maxTasks: number
}

export type OrchestratorDecision = {
  action: OrchestratorAction
  nextTask?: {
    criterion: EngineCriterion
    taskType: CanonicalTaskType
    taskTypeUi: string
    difficulty: number
    rationale: string
  }
  sufficientEvidence: Record<EngineCriterion, boolean>
}

const DIFFICULTY_MIN = 1
const DIFFICULTY_MAX = 8

const TASK_LIBRARY: Array<{
  type: CanonicalTaskType
  criterion: EngineCriterion
  minDifficulty: number
  maxDifficulty: number
  uiAliases: string[]
}> = [
  { type: 'variable_sorter', criterion: 'B', minDifficulty: 1, maxDifficulty: 8, uiAliases: ['iv_dv_cv_sort'] },
  { type: 'variable_matching', criterion: 'B', minDifficulty: 2, maxDifficulty: 7, uiAliases: ['matching'] },
  { type: 'investigation_design', criterion: 'B', minDifficulty: 6, maxDifficulty: 8, uiAliases: ['short_answer', 'extended_response'] },
  { type: 'simulation_data_collection', criterion: 'C', minDifficulty: 3, maxDifficulty: 8, uiAliases: ['simulation_probe', 'table_completion'] },
  { type: 'graph_interpretation', criterion: 'C', minDifficulty: 4, maxDifficulty: 8, uiAliases: ['graph_analysis'] },
  { type: 'claim_evidence_reasoning', criterion: 'C', minDifficulty: 5, maxDifficulty: 8, uiAliases: ['short_answer'] },
  { type: 'error_analysis', criterion: 'C', minDifficulty: 5, maxDifficulty: 8, uiAliases: ['fill_blank', 'matching'] },
  { type: 'reflection_evaluation', criterion: 'C', minDifficulty: 6, maxDifficulty: 8, uiAliases: ['extended_response'] },
]

function clampDifficulty(value: number) {
  return Math.max(DIFFICULTY_MIN, Math.min(DIFFICULTY_MAX, Math.round(value)))
}

function normalizeCorrectness(raw: unknown) {
  const n = Number(raw)
  if (Number.isFinite(n)) {
    return Math.max(0, Math.min(1, n))
  }
  return 0
}

export function mapUiTaskTypeToCanonical(uiTaskType?: string | null): CanonicalTaskType {
  const candidate = (uiTaskType ?? '').trim()
  const byAlias = TASK_LIBRARY.find((x) => x.uiAliases.includes(candidate))
  if (byAlias) return byAlias.type
  if (TASK_LIBRARY.some((x) => x.type === candidate)) return candidate as CanonicalTaskType
  return 'claim_evidence_reasoning'
}

function mapCanonicalToUi(taskType: CanonicalTaskType, enabledTaskTypes: string[]) {
  const allowed = new Set(enabledTaskTypes)
  const def = TASK_LIBRARY.find((x) => x.type === taskType)
  if (!def || def.uiAliases.length === 0) return taskType
  const exactAllowed = def.uiAliases.find((a) => allowed.has(a))
  if (exactAllowed) return exactAllowed
  return def.uiAliases[0]
}

function criterionTaskPool(criterion: EngineCriterion, enabledTaskTypes: string[]) {
  const enabled = new Set(enabledTaskTypes)
  const pool = TASK_LIBRARY.filter((t) => t.criterion === criterion).filter((t) => {
    if (enabled.size === 0) return true
    return t.uiAliases.some((a) => enabled.has(a))
  })
  return pool.length > 0 ? pool : TASK_LIBRARY.filter((t) => t.criterion === criterion)
}

function hasMinimumEvidenceForCriterion(
  criterion: EngineCriterion,
  evidence: EvidencePoint[],
  enabledTaskTypes: string[]
) {
  const byCriterion = evidence.filter((e) => e.criterion === criterion)
  if (byCriterion.length < 3) return false

  if (criterion === 'B') {
    const types = new Set(byCriterion.map((e) => e.taskType))
    const bFoundational = types.has('variable_sorter') || types.has('variable_matching')
    const bDesign = types.has('investigation_design')
    const canRunDesign = criterionTaskPool('B', enabledTaskTypes).some((t) => t.type === 'investigation_design')
    return bFoundational && (bDesign || !canRunDesign)
  }

  if (criterion === 'C') {
    const types = new Set(byCriterion.map((e) => e.taskType))
    const hasData = types.has('simulation_data_collection')
    const hasInterpretation = types.has('graph_interpretation') || types.has('claim_evidence_reasoning')
    const hasEvaluation = types.has('error_analysis') || types.has('reflection_evaluation')

    const pool = criterionTaskPool('C', enabledTaskTypes)
    const canRunData = pool.some((t) => t.type === 'simulation_data_collection')
    const canRunInterp = pool.some((t) => t.type === 'graph_interpretation' || t.type === 'claim_evidence_reasoning')
    const canRunEval = pool.some((t) => t.type === 'error_analysis' || t.type === 'reflection_evaluation')

    return (hasData || !canRunData) && (hasInterpretation || !canRunInterp) && (hasEvaluation || !canRunEval)
  }

  return byCriterion.length >= 3
}

function pickCriterion(criteria: EngineCriterion[], evidence: EvidencePoint[]) {
  const bCount = evidence.filter((e) => e.criterion === 'B').length
  if (criteria.includes('C') && criteria.includes('B') && bCount < 2) {
    return 'B' as EngineCriterion
  }

  for (const c of criteria) {
    if (evidence.filter((e) => e.criterion === c).length < 3) return c
  }

  return criteria[criteria.length - 1] ?? 'B'
}

function pickTaskType(
  criterion: EngineCriterion,
  evidence: EvidencePoint[],
  enabledTaskTypes: string[],
  preferredDifficulty: number
) {
  const pool = criterionTaskPool(criterion, enabledTaskTypes)
  const poolFiltered = pool.filter((p) => preferredDifficulty >= p.minDifficulty && preferredDifficulty <= p.maxDifficulty)
  const candidates = poolFiltered.length > 0 ? poolFiltered : pool

  const counts = new Map<CanonicalTaskType, number>()
  for (const task of evidence.filter((e) => e.criterion === criterion)) {
    counts.set(task.taskType, (counts.get(task.taskType) ?? 0) + 1)
  }

  const sorted = [...candidates].sort((a, b) => {
    const cA = counts.get(a.type) ?? 0
    const cB = counts.get(b.type) ?? 0
    if (cA !== cB) return cA - cB
    return a.minDifficulty - b.minDifficulty
  })

  return sorted[0]
}

export function selectNextTaskDecision(
  evidence: EvidencePoint[],
  config: OrchestratorConfig
): OrchestratorDecision {
  const criteria = config.criteria.length > 0 ? config.criteria : (['B', 'C'] as EngineCriterion[])
  const maxTasks = Math.max(1, config.maxTasks || 10)
  const totalTasks = evidence.length

  const sufficientEvidence = {
    A: hasMinimumEvidenceForCriterion('A', evidence, config.enabledTaskTypes),
    B: hasMinimumEvidenceForCriterion('B', evidence, config.enabledTaskTypes),
    C: hasMinimumEvidenceForCriterion('C', evidence, config.enabledTaskTypes),
    D: hasMinimumEvidenceForCriterion('D', evidence, config.enabledTaskTypes),
  } satisfies Record<EngineCriterion, boolean>

  const allDone = criteria.every((c) => sufficientEvidence[c])
  if (allDone || totalTasks >= maxTasks) {
    return {
      action: 'finish_assessment',
      sufficientEvidence,
    }
  }

  const criterion = pickCriterion(criteria, evidence)
  const byCriterion = evidence.filter((e) => e.criterion === criterion)
  const last = byCriterion[byCriterion.length - 1]

  let targetDifficulty = clampDifficulty(last?.difficulty ?? 5)
  if (last && normalizeCorrectness(last.correctness) < 0.5) {
    targetDifficulty = clampDifficulty(targetDifficulty - 2)
  } else if (byCriterion.length >= 2) {
    const recent = byCriterion.slice(-2)
    if (recent.every((x) => normalizeCorrectness(x.correctness) > 0.9)) {
      targetDifficulty = clampDifficulty(targetDifficulty + 2)
    }
  }

  const task = pickTaskType(criterion, evidence, config.enabledTaskTypes, targetDifficulty)
  const uiTaskType = mapCanonicalToUi(task.type, config.enabledTaskTypes)

  const rationale = last && normalizeCorrectness(last.correctness) < 0.5
    ? `Recent ${criterion} performance indicates remediation. Dropping difficulty to ${targetDifficulty}.`
    : `Collecting more ${criterion} evidence with ${task.type} at difficulty ${targetDifficulty}.`

  return {
    action: 'present_task',
    sufficientEvidence,
    nextTask: {
      criterion,
      taskType: task.type,
      taskTypeUi: uiTaskType,
      difficulty: targetDifficulty,
      rationale,
    },
  }
}

export function computeSubmissionSignals(submissionData: any, taskConfig: any) {
  const correctness = normalizeCorrectness(submissionData?.correctness ?? submissionData?.score)
  const expectedSeconds = Number(taskConfig?.estimated_duration_seconds ?? 300)
  const spentSeconds = Number(submissionData?.time_spent_seconds ?? submissionData?.elapsed_seconds ?? 0)
  const safeExpected = Number.isFinite(expectedSeconds) && expectedSeconds > 0 ? expectedSeconds : 300
  const timeEfficiency = spentSeconds > 0 ? safeExpected / spentSeconds : 1

  const boundedEfficiency = Math.max(0.5, Math.min(1.6, timeEfficiency))
  const blended = Math.max(0, Math.min(1, correctness * 0.82 + (boundedEfficiency - 0.5) / 1.1 * 0.18))
  const indicatedLevel = clampDifficulty(1 + blended * 7)

  return {
    correctness,
    time_efficiency: Number(boundedEfficiency.toFixed(3)),
    indicated_level: indicatedLevel,
  }
}

function computeVariance(levels: number[]) {
  if (levels.length <= 1) return 0
  const avg = levels.reduce((sum, x) => sum + x, 0) / levels.length
  return levels.reduce((sum, x) => sum + (x - avg) ** 2, 0) / levels.length
}

function levelBand(level: number) {
  if (level <= 2) return '1-2'
  if (level <= 4) return '3-4'
  if (level <= 6) return '5-6'
  return '7-8'
}

export function aggregateCriterionScore(
  criterion: EngineCriterion,
  evidence: EvidencePoint[],
  enabledTaskTypes: string[]
) {
  const relevant = evidence.filter((e) => e.criterion === criterion)
  if (!hasMinimumEvidenceForCriterion(criterion, evidence, enabledTaskTypes)) {
    return {
      rubric_level: 0,
      rubric_level_band: 'insufficient',
      confidence_score: 0,
      justification: `Insufficient evidence for Criterion ${criterion}. Minimum multimodal evidence guardrails were not met.`,
      evidence_summary: {
        task_count: relevant.length,
        required_minimum: 3,
      },
    }
  }

  let totalWeight = 0
  let weightedSum = 0
  for (const point of relevant) {
    weightedSum += point.indicatedLevel * point.weight
    totalWeight += point.weight
  }

  const avg = totalWeight > 0 ? weightedSum / totalWeight : 0
  const rubricLevel = clampDifficulty(Math.round(avg))
  const variance = computeVariance(relevant.map((x) => x.indicatedLevel))
  const confidence = Math.max(0.15, Math.min(0.98, 1 - variance / 8))
  const unstable = Math.max(...relevant.map((x) => x.indicatedLevel)) - Math.min(...relevant.map((x) => x.indicatedLevel)) > 3

  return {
    rubric_level: rubricLevel,
    rubric_level_band: levelBand(rubricLevel),
    confidence_score: Number(confidence.toFixed(3)),
    justification: unstable
      ? `Criterion ${criterion} scored at Level ${rubricLevel}. Evidence variance is high, so teacher review is recommended.`
      : `Criterion ${criterion} scored at Level ${rubricLevel} with ${relevant.length} evidence points.`,
    evidence_summary: {
      task_count: relevant.length,
      weighted_average: Number(avg.toFixed(2)),
      variance: Number(variance.toFixed(3)),
      unstable_variation_flag: unstable,
      tasks: relevant.map((x) => ({
        criterion: x.criterion,
        task_type: x.taskType,
        difficulty: x.difficulty,
        correctness: x.correctness,
        indicated_level: x.indicatedLevel,
        weight: x.weight,
      })),
    },
  }
}

export function buildTaskConfig(args: {
  taskType: CanonicalTaskType
  taskTypeUi: string
  criterion: EngineCriterion
  difficulty: number
  topic: string
  simulationUrl?: string | null
}) {
  const { taskType, taskTypeUi, criterion, difficulty, topic, simulationUrl } = args

  const basePromptByTask: Record<CanonicalTaskType, string> = {
    variable_sorter: `Sort IV, DV, and CV correctly for a ${topic} investigation before explaining your choices.`,
    variable_matching: `Match each statement to the correct variable role in a ${topic} experiment.`,
    simulation_data_collection: `Use the simulation to collect at least 5 data points related to ${topic}, then submit your data table.`,
    graph_interpretation: `Interpret the graph trend and explain one scientific conclusion for ${topic}.`,
    claim_evidence_reasoning: `Write a claim and support it using evidence from the artifact for ${topic}.`,
    error_analysis: `Inspect the shown method/data and identify a key error plus a correction.`,
    investigation_design: `Order and justify experimental steps for a fair ${topic} investigation.`,
    reflection_evaluation: `Evaluate reliability/limitations and suggest one improvement for this ${topic} task.`,
  }

  return {
    criterion,
    task_type: taskType,
    task_type_ui: taskTypeUi,
    difficulty_level: difficulty,
    title: `${topic} • ${taskType.replaceAll('_', ' ')}`,
    prompt: basePromptByTask[taskType],
    estimated_duration_seconds: 300,
    simulation_url: simulationUrl ?? null,
  }
}
