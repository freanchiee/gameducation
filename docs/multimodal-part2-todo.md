# Multimodal Assessment Engine - Part 2 TODO

## Scope Reference
- Source: `voiceiq-multimodal-blueprint-part2.docx (1).pdf`
- Objective: move from multimodal prompts to a true runtime engine (task runs, event logging, orchestration, evidence scoring).

## Gap Analysis (current vs Part 2)
- ✅ Assessment authoring has multimodal config and task-type toggles.
- ✅ Student view has side-task widgets and media panel.
- ❌ No dedicated runtime tables for task runs/events/evidence/scoring decisions.
- ❌ No multimodal orchestration API (`/api/multimodal/session/start`, `/task/submit`, `/task/events`).
- ❌ No strict evidence guardrails before criterion scoring.
- ❌ No structured scoring decision records with confidence + explainability.

## Implementation Plan (Step-by-step)
1. ✅ Add Part 2 runtime schema migration (`006_multimodal_part2_runtime.sql`).
2. ✅ Build orchestration/scoring utility module (`lib/multimodal/engine.ts`).
3. ✅ Build runtime persistence/service module (`lib/multimodal/runtime.ts`).
4. ✅ Add APIs:
   - `POST /api/multimodal/session/start`
   - `POST /api/multimodal/task/events`
   - `POST /api/multimodal/task/submit`
5. ✅ Wire student session flow to new APIs:
   - Initialize runtime task run for multimodal sessions.
   - Batch-upload task interaction events every 10s.
   - Submit structured task evidence before next examiner turn.
6. ⏳ Add teacher live monitor view of task runs/events/scoring decisions.
7. ⏳ Add mobile fallback UX from Part 2 section G.2.
8. ⏳ Add unit + integration tests for orchestrator and multimodal APIs.

## New DB Objects
- `multimodal_tasks`
- `session_task_runs`
- `task_events`
- `rubric_evidence`
- `scoring_decisions`

## Rollout
1. Run migration `supabase/migrations/006_multimodal_part2_runtime.sql` in Supabase SQL editor.
2. Restart dev server.
3. Start a multimodal session and verify:
   - task run starts from `/api/multimodal/session/start`
   - events are written to `task_events`
   - submit writes to `rubric_evidence`
   - completion writes to `scoring_decisions`
