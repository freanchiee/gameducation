import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAssessorPrompt } from '@/lib/prompts/assessor'
import { claudeClient } from '@/lib/claude'
import type { Message } from '@/lib/types'

/**
 * Normalise a simulation/embed URL before sending to the client.
 *
 * Critical bug this prevents: the naive "last path segment" approach extracts
 * `false` from already-normalised GeoGebra iframe URLs like:
 *   /material/iframe/id/XXXX/.../rc/false/ai/false
 * which causes GeoGebra to load its default "Linear Functions Explorer" applet.
 *
 * Fix: always match the real material ID from the `/id/<ID>` segment.
 */
function normalizeEmbedUrl(raw: string): string {
  if (!raw) return raw
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()

    if (host.includes('youtube.com') || host.includes('youtu.be')) {
      const vid =
        u.searchParams.get('v') ||
        (host.includes('youtu.be') ? u.pathname.slice(1) : null) ||
        u.pathname.split('/').pop()
      return vid ? `https://www.youtube.com/embed/${vid}` : raw
    }

    if (host.includes('geogebra.org')) {
      // Already a normalised iframe URL — extract real ID from /id/<ID>/ segment
      const iframeMatch = u.pathname.match(/\/material\/iframe\/id\/([^/]+)/)
      if (iframeMatch) {
        const id = iframeMatch[1]
        // Guard against broken stored IDs (false/true/null from the old bug)
        if (id && id !== 'false' && id !== 'true' && id !== 'null' && id !== 'undefined') {
          return `https://www.geogebra.org/material/iframe/id/${id}/width/960/height/540/border/888888/rc/false/ai/false`
        }
        return raw
      }
      // Short share link: geogebra.org/m/<ID>
      const shortMatch = u.pathname.match(/^\/m\/([a-zA-Z0-9]+)/)
      if (shortMatch?.[1]) {
        return `https://www.geogebra.org/material/iframe/id/${shortMatch[1]}/width/960/height/540/border/888888/rc/false/ai/false`
      }
    }

    return raw
  } catch {
    return raw
  }
}

/** Returns false if the URL resolved to a known-broken GeoGebra material ID */
function isValidEmbedUrl(url: string): boolean {
  if (!url) return false
  return !/\/id\/(false|true|null|undefined)\b/.test(url)
}

// normalizeEmbedUrl and isValidEmbedUrl are used when simulation resources are
// attached to assessments. Exported so they can be reused in other API routes.
export { normalizeEmbedUrl, isValidEmbedUrl }

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { session_id, participant_id, conversation_history, student_name, question_number } = body

    if (!session_id || !student_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const supabase = await createClient()

    // Fetch session + assessment config
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*, assessments(topic, year_group, system_prompt, topic_context, max_questions, criteria)')
      .eq('id', session_id)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.status !== 'active') {
      return NextResponse.json({ error: 'Session is not active' }, { status: 403 })
    }

    const assessment = session.assessments

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
    const trimmedHistory = (conversation_history as Message[])
      .slice(-20)
      .map((m) => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content,
      }))

    const response = await claudeClient.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: systemPrompt,
      messages: trimmedHistory.length > 0
        ? trimmedHistory
        : [{ role: 'user', content: 'Begin the assessment.' }],
    })

    const question =
      response.content[0].type === 'text' ? response.content[0].text : ''

    // Store AI message in DB
    if (participant_id) {
      await supabase.from('messages').insert({
        session_id,
        participant_id: null,
        role: 'ai',
        content: question,
        timestamp: new Date().toISOString(),
      })
    }

    return NextResponse.json({
      question,
      max_questions: assessment.max_questions ?? 6,
    })
  } catch (err) {
    console.error('[/api/ai/question]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
