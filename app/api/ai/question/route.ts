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

type ClaudeImageBlock = {
  type: 'image'
  source: {
    type: 'base64'
    media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
    data: string
  }
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

function extractScreenshotUrlsFromMessages(history: Message[]) {
  const urls: string[] = []
  const re = /Screenshot URL:\s*(https?:\/\/[^\s]+)/gi
  for (const msg of history) {
    if (msg.role !== 'student' || !msg.content) continue
    let m: RegExpExecArray | null
    while ((m = re.exec(msg.content)) !== null) {
      const candidate = m[1]?.trim()
      if (candidate && !urls.includes(candidate)) urls.push(candidate)
    }
  }
  return urls
}

async function fetchScreenshotBlocks(urls: string[], limit = 2): Promise<ClaudeImageBlock[]> {
  const blocks: ClaudeImageBlock[] = []
  const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
  for (const url of urls.slice(-limit)) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) continue
      const mediaType = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase()
      if (!allowed.has(mediaType)) continue
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.byteLength > 5 * 1024 * 1024) continue
      blocks.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: mediaType as ClaudeImageBlock['source']['media_type'],
          data: buf.toString('base64'),
        },
      })
    } catch {
      // Ignore bad/expired URLs; continue with available images.
    }
  }
  return blocks
}

function extractJsonObject(text: string) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  return text.slice(start, end + 1)
}

type MediaDirective = {
  type: 'image' | 'video' | 'table' | 'simulation'
  material_id?: string
  url?: string
  start?: number
  end?: number
  context?: string
}

type TaskDirective = {
  type:
    | 'simulation_probe'
    | 'graph_analysis'
    | 'table_completion'
    | 'iv_dv_cv_sort'
    | 'matching'
    | 'fill_blank'
    | 'short_answer'
    | 'extended_response'
  title?: string
  prompt?: string
}

function normalizeEmbedUrl(input: string) {
  const raw = input.trim()
  if (!raw) return raw
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()
    if (host.includes('youtu.be')) {
      const id = u.pathname.replace('/', '')
      return id ? `https://www.youtube.com/embed/${id}` : raw
    }
    if (host.includes('youtube.com')) {
      const id = u.searchParams.get('v')
      return id ? `https://www.youtube.com/embed/${id}` : raw
    }
    if (host.includes('geogebra.org')) {
      const parts = u.pathname.split('/').filter(Boolean)
      const id = parts[parts.length - 1]
      if (id) return `https://www.geogebra.org/material/iframe/id/${id}/width/960/height/540/border/888888/rc/false/ai/false`
    }
    return raw
  } catch {
    return raw
  }
}

function buildFallbackTaskDirective(
  taskTypes: string[],
  questionNumber: number,
  topic: string
): TaskDirective {
  const defaults: TaskDirective['type'][] = [
    'iv_dv_cv_sort',
    'table_completion',
    'graph_analysis',
    'matching',
    'short_answer',
    'extended_response',
  ]
  const normalized = taskTypes.filter(Boolean) as TaskDirective['type'][]
  const pool = normalized.length > 0 ? normalized : defaults
  const selected = pool[(Math.max(questionNumber, 1) - 1) % pool.length]

  const byType: Record<TaskDirective['type'], { title: string; prompt: string }> = {
    simulation_probe: {
      title: 'Simulation probe',
      prompt: `Manipulate one parameter in the simulation and describe how the observed outcome changes for ${topic}.`,
    },
    graph_analysis: {
      title: 'Graph interpretation',
      prompt: `Use the shown graph/data to identify one trend and one possible scientific explanation related to ${topic}.`,
    },
    table_completion: {
      title: 'Data table completion',
      prompt: `Fill the table with observed/estimated values, then infer a relationship connected to ${topic}.`,
    },
    iv_dv_cv_sort: {
      title: 'IV / DV / CV sorting',
      prompt: `Classify the variables into independent, dependent, and controlled variables for a ${topic} investigation.`,
    },
    matching: {
      title: 'Concept matching',
      prompt: `Match each claim with the most relevant evidence/result from the multimodal material.`,
    },
    fill_blank: {
      title: 'Structured completion',
      prompt: `Complete the scientific statement with precise terms and justify one key term choice.`,
    },
    short_answer: {
      title: 'Short evidence answer',
      prompt: `Write a concise answer using one specific piece of evidence from the media.`,
    },
    extended_response: {
      title: 'Extended reasoning',
      prompt: `Write a deeper explanation using data, comparison, and evaluation linked to ${topic}.`,
    },
  }

  return { type: selected, ...byType[selected] }
}

function prependMultimodalIntro(question: string, questionNumber: number) {
  if (questionNumber !== 1) return question
  if (/on-screen|simulation|task/i.test(question)) return question
  return `Before you answer, use the on-screen task or simulation and observe what changes. ${question}`
}

function parseMediaDirectives(text: string) {
  const directives: MediaDirective[] = []

  const imageRe = /\[SHOW_IMAGE:\s*material_id=([^,\]]+)(?:,\s*context=['"]([^'"]+)['"])?\s*\]/g
  const videoRe = /\[SHOW_VIDEO:\s*material_id=([^,\]]+)(?:,\s*start=(\d+))?(?:,\s*end=(\d+))?\s*\]/g
  const tableRe = /\[SHOW_TABLE:\s*material_id=([^,\]]+)(?:,\s*context=['"]([^'"]+)['"])?\s*\]/g
  const simRe = /\[EMBED_SIMULATION:\s*url=([^\]]+)\]/g

  let m: RegExpExecArray | null
  while ((m = imageRe.exec(text)) !== null) {
    directives.push({ type: 'image', material_id: m[1]?.trim(), context: m[2]?.trim() })
  }
  while ((m = videoRe.exec(text)) !== null) {
    directives.push({
      type: 'video',
      material_id: m[1]?.trim(),
      start: m[2] ? Number(m[2]) : undefined,
      end: m[3] ? Number(m[3]) : undefined,
    })
  }
  while ((m = tableRe.exec(text)) !== null) {
    directives.push({ type: 'table', material_id: m[1]?.trim(), context: m[2]?.trim() })
  }
  while ((m = simRe.exec(text)) !== null) {
    directives.push({ type: 'simulation', url: m[1]?.trim() })
  }

  const cleaned = text
    .replace(imageRe, '')
    .replace(videoRe, '')
    .replace(tableRe, '')
    .replace(simRe, '')
    .trim()

  return { cleanedQuestion: cleaned, directives }
}

function parseTaskDirective(text: string) {
  const taskRe =
    /\[TASK_WIDGET:\s*type=([^,\]]+)(?:,\s*title=['"]([^'"]+)['"])?(?:,\s*prompt=['"]([^'"]+)['"])?\s*\]/i
  const match = text.match(taskRe)
  const directive = match
    ? {
        type: (match[1]?.trim() ?? 'short_answer') as TaskDirective['type'],
        title: match[2]?.trim(),
        prompt: match[3]?.trim(),
      }
    : null

  const cleaned = text.replace(taskRe, '').trim()
  return { cleaned, directive }
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
    let { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*, assessments(id, topic, year_group, system_prompt, topic_context, max_questions, criteria, assessment_mode, multimodal_engine_mode, multimodal_task_types)')
      .eq('id', session_id)
      .single()

    if (sessionError && /assessment_mode|multimodal_engine_mode|multimodal_task_types|PGRST204|column/i.test(sessionError.message ?? '')) {
      const fallback = await supabase
        .from('sessions')
        .select('*, assessments(id, topic, year_group, system_prompt, topic_context, max_questions, criteria)')
        .eq('id', session_id)
        .single()
      session = fallback.data as typeof session
      sessionError = fallback.error
    }

    if (sessionError || !session) {
      console.warn('[/api/ai/question] session lookup failed', { reqId, sessionError })
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.status !== 'active') {
      console.warn('[/api/ai/question] inactive session', { reqId, status: session.status })
      return NextResponse.json({ error: 'Session is not active' }, { status: 403 })
    }

    const assessment = session.assessments
    const isMultimodal = (assessment as any).assessment_mode === 'multimodal'
    const engineMode = ((assessment as any).multimodal_engine_mode ?? 'auto') as 'auto' | 'advanced'
    const configuredTaskTypes = Array.isArray((assessment as any).multimodal_task_types)
      ? ((assessment as any).multimodal_task_types as string[])
      : []

    let multimodalSummary = ''
    let preferredSimulation: { materialId?: string; embedUrl: string } | null = null
    if (isMultimodal) {
      const { data: materials, error: materialsError } = await supabase
        .from('learning_materials')
        .select('id, title, type, processing_status, show_during_assessment, extracted_text, material_data, media_urls')
        .eq('assessment_id', assessment.id)
        .eq('show_during_assessment', true)
        .order('display_order', { ascending: true })
        .limit(12)

      if (!materialsError) {
        multimodalSummary = (materials ?? [])
          .map((m) => {
            const textPreview = (m.extracted_text ?? '').replace(/\s+/g, ' ').slice(0, 220)
            return `- [${m.id}] ${m.title} (${m.type}, ${m.processing_status}) ${textPreview}`
          })
          .join('\n')

        const simMaterial = (materials ?? []).find((m: any) => {
          const kind = typeof m.material_data?.kind === 'string' ? m.material_data.kind : ''
          return kind === 'simulation' || /simulation|geogebra|phet/i.test(`${m.title} ${m.type}`)
        }) as any

        if (simMaterial) {
          const rawUrl =
            (typeof simMaterial.material_data?.embed_url === 'string' && simMaterial.material_data.embed_url) ||
            (typeof simMaterial.material_data?.url === 'string' && simMaterial.material_data.url) ||
            (Array.isArray(simMaterial.media_urls) && typeof simMaterial.media_urls[0] === 'string' ? simMaterial.media_urls[0] : '')
          const embedUrl = normalizeEmbedUrl(rawUrl || '')
          if (embedUrl) {
            preferredSimulation = { materialId: simMaterial.id, embedUrl }
          }
        }
      }
    }

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
      assessmentCriteria: (assessment.criteria as any) ?? ['A'],
      questionNumber: question_number,
      maxQuestions: assessment.max_questions ?? 6,
      multimodalSummary,
      multimodalMode: isMultimodal,
      multimodalEngineMode: engineMode,
      multimodalTaskTypes: configuredTaskTypes as any,
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
      isMultimodal
        ? 'Return ONLY valid JSON with keys: question, concept_focus, mark_concept_covered, task_widget.'
        : 'Return ONLY valid JSON with keys: question, concept_focus, mark_concept_covered.',
      'No markdown.',
      `Target concepts: ${tracker.target_concepts.join(' | ')}`,
      `Already covered: ${tracker.covered_concepts.join(' | ') || 'none'}`,
      `Current concept to test: ${tracker.current_concept}`,
      lastStudentMessage
        ? `Latest student response: ${lastStudentMessage}`
        : 'No student response yet.',
      'Set mark_concept_covered=true only if latest response demonstrates adequate understanding for the current concept.',
      'Write one concise Socratic follow-up question.',
      isMultimodal && question_number === 1
        ? 'In your question text, include a brief instruction that student should use the on-screen task/simulation while responding.'
        : 'Do not add unnecessary preamble.',
      isMultimodal && preferredSimulation
        ? `Use EMBED_SIMULATION with this URL when relevant: ${preferredSimulation.embedUrl}`
        : 'No guaranteed simulation URL available.',
      isMultimodal
        ? `If useful, include task_widget as: {"type":"${(configuredTaskTypes[0] ?? 'short_answer')}","title":"...","prompt":"..."}.`
        : 'Do not include task_widget.',
    ].join('\n')

    const screenshotUrls = extractScreenshotUrlsFromMessages((conversation_history ?? []) as Message[])
    const screenshotBlocks = await fetchScreenshotBlocks(screenshotUrls, 2)
    const userContent: any =
      screenshotBlocks.length > 0
        ? [
            {
              type: 'text',
              text: `${conceptControlPrompt}\n\nStudent screenshot evidence is attached. Use it to judge whether task work appears correct before asking the next question.`,
            },
            ...screenshotBlocks,
          ]
        : conceptControlPrompt

    const response = await claudeClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages: trimmedHistory.length > 0
        ? [
            ...trimmedHistory,
            { role: 'user', content: userContent } as const,
          ]
        : [{ role: 'user', content: `${conceptControlPrompt}\nBegin the assessment.` }],
    })

    const rawText = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsedJsonText = extractJsonObject(rawText)
    let parsed: {
      question?: string
      concept_focus?: string
      mark_concept_covered?: boolean
      task_widget?: TaskDirective
    } = {}
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

    const aiOutput = (parsed.question ?? rawText ?? '').trim()
    const { cleanedQuestion, directives } = parseMediaDirectives(aiOutput)
    const { cleaned, directive: inlineTaskDirective } = parseTaskDirective(cleanedQuestion || aiOutput)
    const parsedTaskDirective =
      parsed.task_widget && parsed.task_widget.type
        ? parsed.task_widget
        : null
    const taskDirective =
      inlineTaskDirective ??
      parsedTaskDirective ??
      (isMultimodal
        ? buildFallbackTaskDirective(configuredTaskTypes, question_number, assessment.topic)
        : null)
    const criteria = Array.isArray((assessment as any).criteria) ? ((assessment as any).criteria as string[]) : []
    const bOrCEnabled = criteria.includes('B') || criteria.includes('C')
    const ensuredTaskDirective =
      taskDirective ??
      (isMultimodal && bOrCEnabled ? buildFallbackTaskDirective(configuredTaskTypes, question_number, assessment.topic) : null)
    let question = cleaned || cleanedQuestion || aiOutput
    question = prependMultimodalIntro(question, question_number)

    if (isMultimodal && preferredSimulation && directives.every((d) => d.type !== 'simulation')) {
      directives.unshift({
        type: 'simulation',
        material_id: preferredSimulation.materialId,
        url: preferredSimulation.embedUrl,
        context: question_number === 1
          ? 'Manipulate one variable, observe changes, then answer the examiner.'
          : 'Use the simulation evidence to support your response.',
      })
    }

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
      directives_count: directives.length,
      task_type: ensuredTaskDirective?.type ?? null,
      vision_images_used: screenshotBlocks.length,
    })

    return NextResponse.json({
      question,
      media_directives: directives,
      task_directive: ensuredTaskDirective,
      vision_evidence_used: screenshotBlocks.length > 0,
      vision_images_used: screenshotBlocks.length,
      assessment_mode: (assessment as any).assessment_mode ?? 'voice',
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
