import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  MIGRATION_HINT,
  loadEvidenceForParticipant,
  resolveRuntimeContext,
  saveFinalScores,
} from '@/lib/multimodal/runtime'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const sessionId = String(body?.session_id ?? '')
    const participantId = String(body?.participant_id ?? '')

    if (!sessionId || !participantId) {
      return NextResponse.json(
        { error: 'session_id and participant_id are required' },
        { status: 400 }
      )
    }

    const supabase = createAdminClient()
    const context = await resolveRuntimeContext(supabase, sessionId, participantId)
    const evidence = await loadEvidenceForParticipant(supabase, participantId)

    await saveFinalScores(supabase, context, evidence)

    // Mark session as completed
    await supabase
      .from('sessions')
      .update({ status: 'completed', completed_at: new Date().toISOString() })
      .eq('id', sessionId)

    // Fetch the persisted scoring decisions to include in the response
    const { data: decisions } = await supabase
      .from('scoring_decisions')
      .select('criterion, rubric_level, rubric_level_band, justification, confidence_score, evidence_summary')
      .eq('participant_id', participantId)
      .order('criterion', { ascending: true })

    return NextResponse.json({
      status: 'finalized',
      session_id: sessionId,
      participant_id: participantId,
      scoring_decisions: decisions ?? [],
      evidence_count: evidence.length,
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
