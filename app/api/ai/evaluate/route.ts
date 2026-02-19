import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildEvaluationPrompt } from '@/lib/prompts/rubrics'
import { claudeClient } from '@/lib/claude'
import type { Message } from '@/lib/types'

type ClaudeImageBlock = {
  type: 'image'
  source: {
    type: 'base64'
    media_type: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
    data: string
  }
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

async function fetchScreenshotBlocks(urls: string[], limit = 4): Promise<ClaudeImageBlock[]> {
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
      // ignore failed image fetches
    }
  }
  return blocks
}

export async function POST(request: Request) {
  const startedAt = Date.now()
  const reqId = Math.random().toString(36).slice(2, 10)
  try {
    const body = await request.json()
    const { session_id, participant_id, conversation_history, student_name } = body
    console.log('[/api/ai/evaluate] start', {
      reqId,
      session_id,
      participant_id,
      history_len: Array.isArray(conversation_history) ? conversation_history.length : 0,
    })

    if (!session_id || !conversation_history) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify session exists
    const { data: session } = await supabase
      .from('sessions')
      .select('*, assessments(year_group, criteria, topic)')
      .eq('id', session_id)
      .single()

    if (!session) {
      console.warn('[/api/ai/evaluate] session not found', { reqId })
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const assessment = session.assessments

    // Build transcript from conversation history
    const transcript = (conversation_history as Message[])
      .map((m) => `${m.role === 'ai' ? 'AI Examiner' : student_name}: ${m.content}`)
      .join('\n\n')

    const evaluationPrompt = buildEvaluationPrompt({
      yearGroup: assessment.year_group,
      topic: assessment.topic,
      transcript,
    })

    const screenshotUrls = extractScreenshotUrlsFromMessages((conversation_history as Message[]) ?? [])
    const screenshotBlocks = await fetchScreenshotBlocks(screenshotUrls, 4)
    const evaluationContent: any =
      screenshotBlocks.length > 0
        ? [
            {
              type: 'text',
              text: `${evaluationPrompt}\n\nUse the attached screenshot evidence to strengthen scoring decisions, evidence quotes, and criterion judgments.`,
            },
            ...screenshotBlocks,
          ]
        : evaluationPrompt

    const response = await claudeClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      messages: [{ role: 'user', content: evaluationContent }],
    })

    const rawText =
      response.content[0].type === 'text' ? response.content[0].text : '{}'

    let evaluation: {
      level: number
      levelBand: string
      justification: string
      strengths: string[]
      areasForGrowth: string[]
      evidenceQuotes: string[]
      studentFeedback: string
      teacherNotes: string
    }

    try {
      evaluation = JSON.parse(rawText)
    } catch {
      return NextResponse.json({ error: 'Failed to parse evaluation JSON' }, { status: 500 })
    }

    // Find student_id for the participant
    let studentId: string | null = null
    if (participant_id) {
      const { data: participant } = await supabase
        .from('session_participants')
        .select('student_id')
        .eq('id', participant_id)
        .single()
      studentId = participant?.student_id ?? null
    }

    // Store evaluation in DB
    const { data: savedEval, error: saveError } = await supabase
      .from('evaluations')
      .insert({
        session_id,
        student_id: studentId,
        criterion_a_level: evaluation.level,
        strengths: evaluation.strengths,
        areas_for_growth: evaluation.areasForGrowth,
        evidence_quotes: evaluation.evidenceQuotes,
        feedback_student: evaluation.studentFeedback,
        notes_teacher: evaluation.teacherNotes,
        full_report: evaluation,
        reviewed_by_teacher: false,
      })
      .select('id')
      .single()

    if (saveError) {
      console.error('[/api/ai/evaluate] DB save error:', saveError)
      return NextResponse.json({ error: 'Failed to save evaluation' }, { status: 500 })
    }

    // Mark session as completed
    await supabase
      .from('sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', session_id)

    console.log('[/api/ai/evaluate] success', {
      reqId,
      elapsed_ms: Date.now() - startedAt,
      evaluation_id: savedEval.id,
    })

    return NextResponse.json({ evaluation_id: savedEval.id })
  } catch (err) {
    console.error('[/api/ai/evaluate] error', {
      reqId,
      elapsed_ms: Date.now() - startedAt,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
