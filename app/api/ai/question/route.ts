import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildAssessorPrompt } from '@/lib/prompts/assessor'
import { claudeClient } from '@/lib/claude'
import type { Message } from '@/lib/types'

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
