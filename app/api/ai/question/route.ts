import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildAssessorPrompt } from '@/lib/prompts/assessor'
import { claudeClient } from '@/lib/claude'
import type { Message } from '@/lib/types'

type ConceptTracker = {
  target_concepts: string[]
  covered_concepts: string[]
  current_concept: string
}

function deriveTargetConcepts(topic: string, topicContext?: string | null) {
  const fromContext = (topicContext ?? '')
    .split(/[,\n.;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 4)
    .slice(0, 3)

  if (fromContext.length >= 3) {
    return fromContext
  }

  return [
    `${topic} fundamentals`,
    `${topic} application`,
    `${topic} deeper reasoning`,
  ]
}

function extractJsonObject(text: string) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  return text.slice(start, end + 1)
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  const reqId = Math.random().toString(36).slice(2, 10)
  try {
    const body = await request.json()
    const {
      session_id,
      participant_id,
      conversation_history,
      student_name,
      question_number,
      concept_tracker,
    } = body
    console.log('[/api/ai/question] start', {
      reqId,
      session_id,
      participant_id,
      question_number,
      history_len: Array.isArray(conversation_history) ? conversation_history.length : 0,
    })

    if (!session_id || !student_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Fetch session + assessment config
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*, assessments(topic, year_group, system_prompt, topic_context, max_questions, criteria)')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      console.warn('[/api/ai/question] session lookup failed', { reqId, sessionError })
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.status !== 'active') {
      console.warn('[/api/ai/question] inactive session', { reqId, status: session.status })
      return NextResponse.json({ error: 'Session is not active' }, { status: 403 })
    }

    const assessment = session.assessments
    const maxQuestions = assessment.max_questions ?? 6
    const tracker: ConceptTracker = concept_tracker && Array.isArray(concept_tracker.target_concepts)
      ? {
          target_concepts: concept_tracker.target_concepts,
          covered_concepts: concept_tracker.covered_concepts ?? [],
          current_concept: concept_tracker.current_concept ?? concept_tracker.target_concepts[0],
        }
      : (() => {
          const targets = deriveTargetConcepts(assessment.topic, assessment.topic_context)
          return {
            target_concepts: targets,
            covered_concepts: [],
            current_concept: targets[0],
          }
        })()

    // Build the system prompt
    const systemPrompt = buildAssessorPrompt({
      studentName: student_name,
      topic: assessment.topic,
      yearGroup: assessment.year_group,
      teacherContext: assessment.topic_context ?? '',
      questionNumber: question_number,
      maxQuestions: assessment.max_questions ?? 6,
      customInstructions: assessment.system_prompt ?? '',
    })

    // Trim conversation history to last 10 exchanges to manage token count
    const trimmedHistory = ((conversation_history ?? []) as Message[])
      .slice(-20)
      .map((m) => ({
        role: (m.role === 'ai' ? 'assistant' : 'user') as 'assistant' | 'user',
        content: m.content,
      }))

    const lastStudentMessage = [...(conversation_history as Message[])]
      .reverse()
      .find((m) => m.role === 'student')?.content

    const conceptControlPrompt = [
      'Return ONLY valid JSON with keys: question, concept_focus, mark_concept_covered.',
      'No markdown.',
      `Target concepts: ${tracker.target_concepts.join(' | ')}`,
      `Already covered: ${tracker.covered_concepts.join(' | ') || 'none'}`,
      `Current concept to test: ${tracker.current_concept}`,
      lastStudentMessage
        ? `Latest student response: ${lastStudentMessage}`
        : 'No student response yet.',
      'Set mark_concept_covered=true only if latest response demonstrates adequate understanding for the current concept.',
      'Write one concise Socratic follow-up question.',
    ].join('\n')

    const response = await claudeClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages: trimmedHistory.length > 0
        ? [
            ...trimmedHistory,
            { role: 'user', content: conceptControlPrompt } as const,
          ]
        : [{ role: 'user', content: `${conceptControlPrompt}\nBegin the assessment.` }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsedJsonText = extractJsonObject(rawText)
    let parsed: { question?: string; concept_focus?: string; mark_concept_covered?: boolean } = {}
    if (parsedJsonText) {
      try {
        parsed = JSON.parse(parsedJsonText)
      } catch {
        parsed = {}
      }
    }

    const conceptFocus = parsed.concept_focus?.trim() || tracker.current_concept
    const shouldMarkCovered = Boolean(parsed.mark_concept_covered)
    const coveredSet = new Set(tracker.covered_concepts)
    if (shouldMarkCovered && question_number > 1) {
      coveredSet.add(tracker.current_concept)
    }
    const coveredConcepts = Array.from(coveredSet)
    const nextConcept =
      tracker.target_concepts.find((c) => !coveredSet.has(c)) ??
      tracker.target_concepts[tracker.target_concepts.length - 1]

    const conceptGoalReached = coveredConcepts.length >= tracker.target_concepts.length
    // Use strict > so question_number === maxQuestions still returns the final question;
    // the client hard-stops after the student answers it (nextQ > maxQuestions).
    const safetyCapReached = question_number > maxQuestions
    const shouldFinish = conceptGoalReached || safetyCapReached

    const question = (parsed.question ?? rawText ?? '').trim()

    // Store AI message in DB. AI messages have no participant (participant_id is always null).
    // We insert whenever we have a session_id, regardless of whether a participant exists.
    await supabase.from('messages').insert({
      session_id,
      participant_id: null,
      role: 'ai',
      content: question,
      timestamp: new Date().toISOString(),
    })

    console.log('[/api/ai/question] success', {
      reqId,
      elapsed_ms: Date.now() - startedAt,
      question_chars: question.length,
      concept_focus: conceptFocus,
      covered_count: coveredConcepts.length,
      should_finish: shouldFinish,
    })

    return NextResponse.json({
      question,
      max_questions: maxQuestions,
      concept_tracker: {
        target_concepts: tracker.target_concepts,
        covered_concepts: coveredConcepts,
        current_concept: nextConcept,
      },
      concept_focus: conceptFocus,
      should_finish: shouldFinish,
    })
  } catch (err) {
    console.error('[/api/ai/question] error', {
      reqId,
      elapsed_ms: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
