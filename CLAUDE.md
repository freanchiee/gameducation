# VoiceIQ – AI Oral Assessment Platform

## Project Overview

VoiceIQ replaces written assessments with AI-conducted oral assessments.
Built for MYP and IB schools. Uses the Claude API for Socratic dialogue.
Students answer up to `max_questions` questions verbally; AI generates MYP criterion-referenced scores (0–8 per criterion).

**Target audience:** Teachers at international schools (MYP/IB programmes), students aged 11–18.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router), TypeScript |
| Styling | Tailwind CSS, shadcn/ui (Radix primitives) |
| Database | Supabase (PostgreSQL + Auth + Realtime + Storage) |
| AI Engine | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| Speech | Web Speech API (browser-native STT/TTS) |
| Deployment | Vercel |

**Key packages:** `@anthropic-ai/sdk ^0.30.0`, `@supabase/ssr ^0.5.1`, `@supabase/supabase-js ^2.45.4`, `lucide-react ^0.454.0`, `next 14.2.15`.

---

## Key Conventions

- All Claude API calls go through `lib/claude.ts` — **never** instantiate Anthropic client inline
- System prompts live in `lib/prompts/` — **never** hardcode inline or inside components
- Use `lib/supabase/server.ts` for API routes and Server Components
- Use `lib/supabase/client.ts` for Client Components only
- Use `lib/supabase/admin.ts` (service role) for API routes that need to bypass RLS
- All DB types come from `lib/types/index.ts` — never duplicate type definitions
- Assessment session state is stored in Supabase, not in client state
- **Never** call the Claude API from client-side code — always route through `/api/ai/`
- The `claude.ts` model string is the source of truth: `claude-sonnet-4-20250514`

---

## Directory Structure

```
app/
  (auth)/                   Login, signup, reset-password, update-password
  (dashboard)/              Teacher dashboard — requires Supabase auth
    layout.tsx              Dashboard shell with sidebar nav
    classes/
      page.tsx              Classes list
      new/page.tsx          Create class form
      [id]/page.tsx         Class detail (shows assessments for the class)
    assessments/
      page.tsx              Assessments list
      new/page.tsx          Create assessment form
      [id]/page.tsx         Assessment detail: status toggle, access code, sessions list
    reports/
      page.tsx              Reports list (all completed evaluations)
      evaluation/[id]/page.tsx  Single evaluation: transcript, scores, feedback
  (student)/                Student-facing — code-gated, no auth required
    lobby/page.tsx          Access code + name entry
    session/[id]/page.tsx   Live assessment: voice loop, question fetching
    results/[id]/page.tsx   Post-assessment: scores, feedback, transcript
  api/
    ai/
      question/route.ts     POST — generate next Socratic question via Claude
      evaluate/route.ts     POST — final AI evaluation after session completes
    sessions/route.ts       POST — create session, validate access code, add participant
    assessments/
      [id]/participants/route.ts  GET — list session participants (teacher view)
    auth/
      login/route.ts        POST — Supabase email/password sign-in
      signout/route.ts      POST — sign out teacher
      me/route.ts           GET  — current authenticated user
    participants/
      [id]/typing/route.ts  POST — update allow_text_input for a participant
    transcripts/route.ts    POST — store student message in DB
  layout.tsx                Root layout (system font stack, globals.css only)
  page.tsx                  Root redirect (auth → /classes, anon → /lobby)

components/
  assessment/
    VoiceInterface.tsx      Mic button, recording state, interim transcript, text fallback
    ConversationFeed.tsx    Scrolling AI/student message history
    ResultsCard.tsx         Post-assessment: criterion level badge, strengths, growth areas
  teacher/
    NewAssessmentForm.tsx   Multi-field assessment creation form
    AssessmentActions.tsx   Status toggle, access code display, session list
    ReviewButton.tsx        Teacher evaluation review (mark as reviewed)
    TypingPermissions.tsx   Allow/deny text input per participant in group sessions
  dashboard/
    sidebar-nav.tsx         Dashboard navigation sidebar
  ui/                       shadcn/ui primitives (button, input, card, dialog, select,
                            tabs, toast, toaster, badge, skeleton, separator, textarea, switch)

lib/
  claude.ts                 Anthropic SDK client (server-side singleton)
  types/index.ts            All TypeScript interfaces (DB tables + AI response types)
  prompts/
    assessor.ts             Socratic dialogue system prompt builder
    rubrics.ts              MYP evaluation prompt + structured JSON output schema
    subjects.ts             Subject topics, year groups, concept maps (Physics/Chem/Bio)
  supabase/
    server.ts               Server-side Supabase client (Server Components, API routes)
    client.ts               Browser-side Supabase client (Client Components)
    admin.ts                Admin client using SUPABASE_SERVICE_ROLE_KEY
    env.ts                  Environment variable validation helpers

scripts/
  create-test-user.mjs      Seed script to create a test teacher account

supabase/
  migrations/
    001_initial_schema.sql                        Full DB schema + RLS policies
    002_session_participant_text_permissions.sql   Adds student_name + allow_text_input
```

---

## Environment Variables

| Variable | Side | Purpose |
|----------|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Bypasses RLS for admin operations |
| `ANTHROPIC_API_KEY` | Server only | Claude API access |

**Critical:** `ANTHROPIC_API_KEY` and `SUPABASE_SERVICE_ROLE_KEY` must **never** appear in `NEXT_PUBLIC_*` variables.

---

## Running Locally

```bash
cp .env.example .env.local   # Fill in Supabase + Anthropic keys
npm install
npm run dev                  # Runs on http://localhost:3000 (NODE_TLS_REJECT_UNAUTHORIZED=0)
```

**Database setup:** Apply migrations in order against your Supabase project:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_session_participant_text_permissions.sql`

**Create test user:**
```bash
npm run seed:test-user       # node --env-file=.env scripts/create-test-user.mjs
```

---

## Database Schema

### Tables

| Table | Purpose | Key Fields |
|-------|---------|-----------|
| `schools` | Institution | id, name, subscription_plan (`free`/`teacher_pro`/`school`/`district`), max_students |
| `profiles` | Teachers + students (extends auth.users) | id, email, full_name, role (`teacher`/`student`), school_id |
| `classes` | Teacher-created classes | id, teacher_id, name, year_group, programme (`MYP`/`DP`), subject |
| `class_enrolments` | Student↔class links | id, class_id, student_id, enrolled_at |
| `assessments` | Assessment configs | id, class_id, title, subject, topic, year_group, criteria (JSONB), max_questions, allow_group, max_group_size, system_prompt, topic_context, status (`draft`/`active`/`closed`), access_code (6-char uppercase) |
| `sessions` | Assessment runs | id, assessment_id, mode (`individual`/`group`), status (`waiting`/`active`/`completed`), started_at, completed_at |
| `session_participants` | Students in a session | id, session_id, student_id (nullable for anonymous), student_name, allow_text_input, joined_at |
| `messages` | Conversation transcript | id, session_id, participant_id, role (`ai`/`student`), content, audio_url, timestamp |
| `evaluations` | AI-generated results | id, session_id, student_id, criterion_a/b/c/d_level (0–8), strengths[], areas_for_growth[], evidence_quotes[], feedback_student, notes_teacher, full_report (JSONB: `EvaluationReport`), reviewed_by_teacher, teacher_override_level |

**Row Level Security:** All tables have RLS enabled. Teachers see only their own data. Service role (admin client) is used in API routes to insert evaluations and fetch session data. See migration files for full policy definitions.

**Indexes:** `classes(teacher_id)`, `assessments(class_id)`, `assessments(access_code)`, `sessions(assessment_id)`, `messages(session_id)`, `evaluations(session_id)`, `evaluations(student_id)`.

---

## TypeScript Interfaces (`lib/types/index.ts`)

Key interfaces mirroring the DB:

- **`School`**, **`Profile`**, **`Class`**, **`ClassEnrolment`**
- **`Assessment`** — includes `criteria: AssessmentCriterion[]` (`'A'|'B'|'C'|'D'`)
- **`Session`** — `mode: SessionMode`, `status: SessionStatus`
- **`SessionParticipant`** — `allow_text_input: boolean`
- **`Message`** — `role: MessageRole` (`'ai'|'student'`)
- **`Evaluation`** — all criterion levels, `teacher_override_level`
- **`EvaluationReport`** — AI output shape: `{ level, levelBand, justification, strengths[], areasForGrowth[], evidenceQuotes[], studentFeedback, teacherNotes }`
- **`AssessorPromptParams`**, **`EvaluationPromptParams`** — prompt builder inputs

---

## MYP Assessment Context

### Criteria (all 0–8 scale)
- **Criterion A:** Knowing and Understanding
- **Criterion B:** Inquiring and Designing
- **Criterion C:** Processing and Evaluating
- **Criterion D:** Reflecting on Impacts of Science

### Supported Subjects (`lib/prompts/subjects.ts`)
- **Physics** (MYP 3–5, DP): Waves, Electricity, Forces & Motion, Thermal Physics, Atomic Physics, Electromagnetism, Energy, Light
- **Chemistry** (MYP 3–5): Atoms & Elements, Chemical Reactions, Bonding, Stoichiometry, Acids & Bases, Organic Chemistry, Electrochemistry
- **Biology** (MYP 3–5): Cell Biology, Ecology, Genetics, Human Physiology, Evolution, Microbiology

### Question Progression (6 default questions)
- Q1–2: Recall (definitions, vocabulary)
- Q3–4: Application (scenarios, predictions)
- Q5–6: Analysis (WHY, comparisons, consequences, real-world impact)

---

## Student Flow (No Auth Required)

1. Student opens `/lobby`, enters 6-char access code + name
2. `POST /api/sessions` validates code → creates session → returns `session_id` + `participant_id`
3. Client stores `voiceiq_session_id`, `voiceiq_participant_id`, `voiceiq_student_name` in **`sessionStorage`** (not `localStorage`, not cookies)
4. Redirects to `/session/[id]`
5. **Assessment loop:**
   - `POST /api/ai/question` with conversation history + `concept_tracker` → returns `{ question, concept_tracker, should_finish }`
   - Student responds via microphone (or text fallback if `allow_text_input === true`)
   - Response stored via `POST /api/transcripts`
   - Loop repeats until `should_finish === true` (all concepts covered or `max_questions` reached)
6. `POST /api/ai/evaluate` with full transcript → Claude returns structured `EvaluationReport` → record created in `evaluations` table
7. Redirect to `/results/[id]` → display level badge, strengths, growth areas, student feedback

---

## Teacher Flow (Auth Required)

1. Sign up at `/signup` → Supabase email/password auth
2. Create class at `/classes/new`
3. Create assessment at `/assessments/new` (select class, topic, criteria, max_questions, allow_group, custom prompt, topic context)
4. Activate assessment → generates 6-char access code (shown at `/assessments/[id]`)
5. Share code with students
6. View results at `/reports` → `/reports/evaluation/[id]` (transcript, AI scores, evidence quotes, student/teacher feedback)

---

## API Routes Reference

### `POST /api/sessions`
- Validates `access_code` against `assessments` table (must be `status = 'active'`)
- Creates or reuses a `session` record
- Creates a `session_participants` record with `student_name`
- Returns `{ session_id, participant_id }`

### `POST /api/ai/question`
- **Input:** `{ session_id, participant_id, student_name, question_number, conversation_history[], concept_tracker }`
- Fetches session + assessment from DB (admin client)
- Builds system prompt via `buildAssessorPrompt()` from `lib/prompts/assessor.ts`
- Trims conversation history to last 20 messages before sending to Claude
- Claude returns **JSON only**: `{ question, concept_focus, mark_concept_covered }`
- Updates `concept_tracker` (marks concepts covered, advances to next concept)
- Sets `should_finish = true` when all concepts covered OR `question_number >= max_questions`
- Stores AI message in `messages` table
- **Output:** `{ question, max_questions, concept_tracker, concept_focus, should_finish }`

### `POST /api/ai/evaluate`
- **Input:** `{ session_id, participant_id, student_name, conversation_history[] }`
- Uses evaluation prompt from `lib/prompts/rubrics.ts`
- Claude returns structured `EvaluationReport` JSON
- Inserts record into `evaluations` table
- Returns `{ evaluation_id }`

### `POST /api/transcripts`
- Stores a student message in the `messages` table

### `POST /api/participants/[id]/typing`
- Updates `allow_text_input` for a `session_participants` record (teacher override)

---

## Auth & Middleware

`middleware.ts` intercepts all routes (except static assets) and:
- **Teacher routes** (`/classes`, `/assessments`, `/reports`): redirects to `/login` if no Supabase session
- **Public/auth routes** (`/login`, `/signup`, `/reset-password`): redirects to `/classes` if already authenticated
- **Student routes** (`/lobby`, `/session/*`, `/results/*`): pass-through (no auth check)

Supabase auth uses SSR cookie-based sessions (`@supabase/ssr`).

---

## Concept Tracker

`/api/ai/question` maintains a `ConceptTracker` object across requests:

```ts
type ConceptTracker = {
  target_concepts: string[]   // derived from topic_context or topic defaults
  covered_concepts: string[]  // concepts the student has demonstrated understanding of
  current_concept: string     // concept being tested right now
}
```

- `target_concepts` are extracted from `assessment.topic_context` (comma/newline-split), falling back to `["${topic} fundamentals", "${topic} application", "${topic} deeper reasoning"]`
- Claude sets `mark_concept_covered: true` when the student's last response shows adequate understanding
- Session ends when all target concepts are covered or `max_questions` is hit

---

## Security Rules

- `ANTHROPIC_API_KEY` — server-only, never in `NEXT_PUBLIC_*` env vars
- Claude is never called from client code — all calls go through `/api/ai/` routes
- Rubric text (`lib/prompts/rubrics.ts`) is never sent to students
- Students are never told they are being scored against a rubric
- Audio storage only occurs if teacher explicitly enables it in assessment settings
- RLS policies enforce that teachers can only access their own data
- Admin Supabase client (`lib/supabase/admin.ts`) is used only in API routes, never imported in client components

---

## Build Phases & Current Status

| Phase | Status | Scope |
|-------|--------|-------|
| **Phase 0** | ✅ COMPLETE | Scaffold, types (`lib/types/index.ts`), Claude wrapper (`lib/claude.ts`), prompts (`lib/prompts/`), DB migration (`001_initial_schema.sql`) |
| **Phase 1** | ✅ COMPLETE | Auth pages: `/login`, `/signup`, `/reset-password`, `/update-password`; Supabase auth integration; env validation (`lib/supabase/env.ts`) |
| **Phase 2** | ✅ COMPLETE | Teacher dashboard: classes list/new/detail, assessments list/new/detail, reports list, evaluation detail, assessment status toggle, access code display, session list; components: `NewAssessmentForm`, `AssessmentActions`, `ReviewButton`, `TypingPermissions`, `sidebar-nav` |
| **Phase 3** | ✅ COMPLETE | Student session: lobby, session voice loop, results page; API routes: `/api/sessions`, `/api/ai/question`, `/api/ai/evaluate`, `/api/transcripts`; concept tracker; `VoiceInterface`, `ConversationFeed`, `ResultsCard` |
| **Phase 4** | ❌ NOT STARTED | Group session mode (multi-student, per-student scoring, turn-based voice, lobby waiting room) |
| **Phase 5** | ❌ NOT STARTED | PDF export, teacher score override UI, class-level analytics |

---

## Font Note

Google Fonts removed (no external network in build environment). Using Tailwind system font stack (`font-sans`). `app/layout.tsx` imports only `./globals.css` — no `next/font` import.

---

## Common Pitfalls for AI Assistants

- Do **not** import `lib/supabase/admin.ts` in Client Components or `lib/supabase/client.ts`
- Do **not** import `lib/claude.ts` anywhere outside `app/api/`
- Do **not** add new DB type definitions — extend `lib/types/index.ts` only
- Do **not** add new system prompt text inline — add to `lib/prompts/`
- Do **not** use `localStorage` for student session data — use `sessionStorage` with the keys `voiceiq_session_id`, `voiceiq_participant_id`, `voiceiq_student_name`
- Do **not** create new Radix primitives from scratch — use the existing `components/ui/` wrappers
- When adding a new API route, use `createAdminClient()` for DB operations that need to bypass RLS (e.g., fetching session data for anonymous students)
- The `dev` script sets `NODE_TLS_REJECT_UNAUTHORIZED=0` — this is intentional for local Supabase TLS; do not remove
