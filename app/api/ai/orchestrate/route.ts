import { NextResponse } from 'next/server'
import { claudeClient, CLAUDE_MODEL } from '@/lib/claude'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  MIGRATION_HINT,
  loadEvidenceForParticipant,
  resolveRuntimeContext,
} from '@/lib/multimodal/runtime'
import { selectNextTaskDecision } from '@/lib/multimodal/engine'

/**
 * POST /api/ai/orchestrate
 *
 * Called after each task submission (or at session start) to generate the
 * AI examiner's next voice prompt.  It:
 *   1. Loads current evidence + decides the next task via the engine.
 *   2. Sends that context to Claude with the ORCHESTRATOR_SYSTEM_PROMPT.
 *   3. Returns a { examiner_prompt, probing_question, scaffolding_hint? } payload.
 */

const ORCHESTRATOR_SYSTEM_PROMPT = `You are an expert MYP science oral examiner conducting a multimodal Criterion B & C assessment.

Your job is to generate a SHORT spoken prompt (2–3 sentences, conversational) that:
1. Briefly acknowledges what the student just did on-screen (task type + criterion).
2. Asks ONE probing Socratic question about their reasoning or methodology.
3. If evidence is low, adds a scaffolding hint (e.g. "Think about what variables you controlled.").

RULES:
- Maximum 3 sentences total.
- Ask ONE question only. Never give the answer.
- Never say "Great job!" or empty praise.
- Never mention rubric levels, scores, or that you are evaluating them.
- If evidence is already sufficient for a criterion, acknowledge completion briefly.
- Use warm, academic, encouraging tone.
- Refer to the student by name if provided.

ADAPTIVE RULES:
- If the student's last performance correctness < 0.4: use a simpler, supportive prompt with scaffolding.
- If correctness > 0.85 for two consecutive tasks on the same criterion: escalate difficulty language.
- If evidence for B is sufficient but not C: shift focus entirely to Criterion C.

OUTPUT FORMAT:
Return ONLY the spoken prompt. No JSON, no preamble, no labels.`

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const sessionId = String(body?.session_id ?? '')
    const participantId = String(body?.participant_id ?? '')
    const studentName = String(body?.student_name ?? 'the student')
    const lastTaskType = String(body?.last_task_type ?? '')
    const lastCriterion = String(body?.last_criterion ?? '')
    const lastCorrectness = Number(body?.last_correctness ?? 0.5)

    if (!sessionId || !participantId) {
      return NextResponse.json({ error: 'session_id and participant_id are required' }, { status: 400 })
    }

    const supabase = createAdminClient()
    const context = await resolveRuntimeContext(supabase, sessionId, participantId)
    const evidence = await loadEvidenceForParticipant(supabase, participantId)
    const decision = selectNextTaskDecision(evidence, {
      criteria: context.criteria,
      enabledTaskTypes: context.enabledTaskTypes,
      maxTasks: context.maxQuestions,
    })

    const evidenceSummary = context.criteria.map((c) => {
      const byCrit = evidence.filter((e) => e.criterion === c)
      return `Criterion ${c}: ${byCrit.length} evidence points, avg correctness ${
        byCrit.length > 0 ? (byCrit.reduce((s, x) => s + x.correctness, 0) / byCrit.length).toFixed(2) : 'n/a'
      }`
    }).join('; ')

    const nextTaskContext = decision.action === 'present_task' && decision.nextTask
      ? `Next task: ${decision.nextTask.taskType} for Criterion ${decision.nextTask.criterion} at difficulty ${decision.nextTask.difficulty}. Rationale: ${decision.nextTask.rationale}`
      : 'All criteria have sufficient evidence. Assessment is complete.'

    const userMessage = `Student: ${studentName}
Topic: ${context.topic}
Last task completed: ${lastTaskType || 'none'} (Criterion ${lastCriterion || 'unknown'})
Last correctness score: ${(lastCorrectness * 100).toFixed(0)}%
Evidence status: ${evidenceSummary}
Engine decision: ${nextTaskContext}

Generate the spoken examiner prompt now.`

    const completion = await claudeClient.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 200,
      system: ORCHESTRATOR_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const examinerPrompt = (completion.content[0] as { type: string; text: string }).text?.trim() ?? ''

    return NextResponse.json({
      examiner_prompt: examinerPrompt,
      action: decision.action,
      next_task: decision.nextTask ?? null,
      sufficient_evidence: decision.sufficientEvidence,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const status = message.includes(MIGRATION_HINT) ? 500 : message.includes('not found') ? 404 : 500
    return NextResponse.json(
      { error: message.includes(MIGRATION_HINT) ? MIGRATION_HINT : message },
      { status }
    )
  }
}
