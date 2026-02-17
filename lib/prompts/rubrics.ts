import type { EvaluationPromptParams } from '@/lib/types'

/**
 * Builds the evaluation prompt sent to Claude after assessment completes.
 * Returns structured JSON evaluation aligned to MYP Criterion A rubric.
 *
 * SECURITY: Server-side only. Never expose rubric text to students during assessment.
 */
export function buildEvaluationPrompt(params: EvaluationPromptParams): string {
  const { yearGroup, topic, transcript } = params

  return `You are scoring an MYP ${yearGroup} student's oral assessment on the topic: ${topic}.

MYP CRITERION A RUBRIC – Knowing and Understanding (0–8):
0:     No response or completely irrelevant. Cannot demonstrate any knowledge.
1–2:   Limited. Recalls isolated facts. Minimal understanding. Frequent errors. Limited terminology.
3–4:   Adequate. Describes concepts with some accuracy. Some correct use of terminology. Understanding is surface-level.
5–6:   Substantial. Applies concepts correctly in familiar contexts. Good use of terminology. Can explain with some depth.
7–8:   Excellent. Analyses and explains in varied contexts. Precise scientific language. Demonstrates deep understanding. Can synthesise and evaluate.

ASSESSMENT TRANSCRIPT:
${transcript}

INSTRUCTIONS:
- Base your scoring ONLY on what the student actually said in the transcript.
- Do not penalise for nervousness or speech disfluencies (um, uh, pauses).
- Do not reward a correct answer that was provided by the AI examiner.
- Evidence quotes must be direct quotes from the student's responses only.
- Be fair and calibrated to the year group level – ${yearGroup} expectations.

Return ONLY valid JSON (no markdown fences, no extra text):
{
  "level": <integer 0–8>,
  "levelBand": "<0|1-2|3-4|5-6|7-8>",
  "justification": "<2–3 sentences explaining why this level, citing specific student responses>",
  "strengths": ["<evidence-based strength>", "<evidence-based strength>"],
  "areasForGrowth": ["<specific conceptual gap>", "<specific gap>"],
  "evidenceQuotes": ["<direct quote from student>", "<direct quote>"],
  "studentFeedback": "<encouraging, specific, forward-looking paragraph, 3–4 sentences, written directly to the student>",
  "teacherNotes": "<clinical summary for teacher: key gaps, recommended follow-up, any concerns about the session>"
}`
}
