# VoiceIQ – AI Oral Assessment Platform

## Project Overview
VoiceIQ replaces written assessments with AI-conducted oral assessments.
Built for MYP and IB schools. Uses Claude API for Socratic dialogue.
Students answer up to 10 questions verbally; AI generates MYP criterion-referenced scores.

## Tech Stack
- **Next.js 14** (App Router), TypeScript 5, Tailwind CSS 3
- **Supabase** (auth + postgres + storage + realtime) — `@supabase/supabase-js@2.45.4`, `@supabase/ssr@0.5.1`
- **Anthropic Claude API** — `claude-sonnet-4-20250514` via `@anthropic-ai/sdk@0.30.0`
- **Web Speech API** (browser native STT/TTS — no third-party dependency)
- **shadcn/ui + Radix UI** for accessible UI primitives
- **Vercel** deployment target

## Key Conventions

### Claude API Usage
- All Claude API calls go through `lib/claude.ts` wrapper — never inline
- System prompts live in `lib/prompts/` — never hardcode inline or in components
- Never call Claude API from client-side code — always use `/api/ai/` routes
- Never expose `ANTHROPIC_API_KEY` in `NEXT_PUBLIC_*` env vars or client code

### Supabase Usage
- Use `lib/supabase/server.ts` (`createClient()`) for API routes and Server Components
- Use `lib/supabase/client.ts` (`createClient()`) for Client Components only
- All DB access uses typed interfaces from `lib/types/index.ts`
- Assessment session state is managed in Supabase, not in client state

### TypeScript
- All database tables have corresponding interfaces in `lib/types/index.ts`
- Always use the defined types — never use `any` for DB records or Claude responses
- Path alias `@/*` maps to the repo root

### Routing
- Route groups in parentheses are for layout organization only: `(auth)`, `(dashboard)`, `(student)`
- Middleware at `middleware.ts` protects `/classes`, `/assessments`, `/reports` — requires Supabase auth
- Student routes (`/lobby`, `/session`, `/results`) are semi-public — code-gated, no auth
- `sessionStorage` only (not localStorage, not cookies) for student session_id + participant_id

### UI / Styling
- Tailwind system font stack (`font-sans`) — Google Fonts removed (no network in build env)
- `app/layout.tsx` imports only `./globals.css` — no `next/font` import
- Dark mode via Tailwind `class` strategy; CSS custom properties (HSL) for theming
- shadcn/ui components live in `components/ui/` — do not modify these directly

---

## Directory Structure

```
app/
  (auth)/
    login/                Login form (email + password)
    signup/               Registration form (name, school, email, password)
    reset-password/       Password reset request
    update-password/      Change password (auth required, post-reset flow)
  (dashboard)/
    layout.tsx            Dashboard shell with sidebar nav
    classes/              List teacher's classes
    classes/new/          Create class form
    classes/[id]/         Class detail + assessment list for that class
    assessments/          List teacher's assessments
    assessments/new/      Assessment builder (NewAssessmentForm component)
    assessments/[id]/     Assessment detail: status, access code, sessions list
    reports/              Evaluations / results list
    reports/evaluation/[id]/  Single evaluation: transcript, scores, teacher notes
  (student)/
    lobby/                Student entry — access code + name input
    session/[id]/         Live assessment — voice interface, conversation feed
    results/[id]/         Post-assessment results and feedback
  api/
    ai/
      question/route.ts   POST — fetches next AI question (Claude API call)
      evaluate/route.ts   POST — scores completed transcript (returns JSON)
    sessions/route.ts     POST — validates access code, creates session + participant
    transcripts/route.ts  POST — stores message in DB
    auth/
      login/route.ts      POST — email/password sign-in
      signout/route.ts    POST — sign teacher out, redirect to /login
      me/route.ts         GET  — returns current user profile
  layout.tsx              Root layout (metadata only, no font imports)
  page.tsx                Root redirect: /classes if authed, /login if not
  globals.css             Tailwind CSS base styles

components/
  assessment/
    VoiceInterface.tsx    Mic button, recording state, Web Speech API, text fallback
    ConversationFeed.tsx  Scrollable AI/student message thread
    ResultsCard.tsx       Score display (0–8 scale with band labels)
  teacher/
    NewAssessmentForm.tsx Assessment builder: topic, criteria, max_questions, context
    AssessmentActions.tsx Status toggle (draft → active → closed) + access code copy
    ReviewButton.tsx      Link to evaluation detail page
  dashboard/
    sidebar-nav.tsx       Dashboard nav: Classes, Assessments, Reports + Sign Out
  ui/                     shadcn/ui base components (Button, Input, Card, Dialog, etc.)

lib/
  claude.ts               Anthropic SDK singleton — server-side only
  prompts/
    assessor.ts           buildAssessorPrompt() — Socratic dialogue system prompt
    rubrics.ts            buildEvaluationPrompt() — criterion-referenced scoring prompt
    subjects.ts           Subject/topic concept maps (Physics, Chemistry, Biology)
  supabase/
    server.ts             createClient() for API routes + Server Components (cookie-based)
    client.ts             createClient() for Client Components (anon key)
    env.ts                hasSupabaseEnv() / getSupabaseEnv() — env validation helpers
  types/
    index.ts              All TypeScript interfaces: DB tables + AI response shapes

supabase/
  migrations/
    001_initial_schema.sql  Full schema with RLS policies and triggers

scripts/
  create-test-user.mjs    Seed a test teacher account (npm run seed:test-user)

middleware.ts             Route guard — Supabase session validation
```

---

## MYP Assessment Context
- **Criterion A** (0–8): Knowing and Understanding
- **Criterion B** (0–8): Inquiring and Designing
- **Criterion C** (0–8): Processing and Evaluating
- **Criterion D** (0–8): Reflecting on Impacts of Science
- Level bands: 0 = Not assessed, 1–2 = Limited, 3–4 = Adequate, 5–6 = Substantial, 7–8 = Excellent
- MVP focus: MYP Year 4 Physics (Waves, Electricity, Forces & Motion)
- Question progression: Q1–Q3 = Recall, Q4–Q5 = Application, Q6+ = Analysis

---

## Student Flow (No Auth Required)

1. Student enters 6-char access code + name at `/lobby`
2. `POST /api/sessions` validates code → creates session + participant → returns `session_id` + `participant_id`
3. Client stores both in `sessionStorage` (not cookies, not localStorage)
4. Session page (`/session/[id]`) fetches first question from `POST /api/ai/question`
5. Student answers via Web Speech API (or text fallback); answer stored via `POST /api/transcripts`
6. After `max_questions`, `POST /api/ai/evaluate` → redirects to `/results/[eval_id]`

---

## Teacher Flow (Auth Required)

1. Sign up / log in via `/signup` or `/login` → Supabase auth → cookie-based session
2. Create class at `/classes/new`
3. Build assessment at `/assessments/new` — set topic, subject, year group, criteria, max questions
4. Activate assessment on `/assessments/[id]` to generate 6-char access code
5. Share code with students; monitor sessions on `/assessments/[id]`
6. Review AI evaluations + transcripts on `/reports/evaluation/[id]`

---

## API Routes Reference

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/ai/question` | Code-gated | Takes conversation history → returns next Claude question |
| POST | `/api/ai/evaluate` | Code-gated | Takes full transcript → returns JSON evaluation with criterion scores |
| POST | `/api/sessions` | Code-gated | Validates access code, creates session + participant record |
| POST | `/api/transcripts` | Code-gated | Stores a message (AI or student) to the DB |
| POST | `/api/auth/login` | Public | Supabase email/password sign-in |
| GET | `/api/auth/me` | Supabase session | Returns current user profile |
| POST | `/api/auth/signout` | Supabase session | Signs teacher out, redirects to /login |

---

## Database Schema (Supabase / PostgreSQL)

All tables have Row Level Security (RLS) enabled.
Run `supabase/migrations/001_initial_schema.sql` against your Supabase project.

| Table | Key Fields | Notes |
|-------|-----------|-------|
| `schools` | id, name, subscription_plan | Subscription plans: free, teacher_pro, school, district |
| `profiles` | id, role, school_id, full_name | Role: teacher \| student; trigger auto-creates on signup |
| `classes` | teacher_id, programme, year_group, subject | programme: MYP \| DP |
| `assessments` | class_id, title, topic, criteria, access_code, max_questions, allow_group, status | status: draft \| active \| closed |
| `sessions` | assessment_id, mode, status, started_at, completed_at | mode: individual \| group |
| `session_participants` | session_id, student_id, name | Links students to sessions |
| `messages` | session_id, participant_id, role, content, audio_url | role: ai \| student |
| `evaluations` | session_id, student_id, criterion_a–d_level (0–8), strengths, areas_for_growth, evidence_quotes, feedback_student, notes_teacher, full_report | AI-generated; teacher-overrideable (Phase 5) |

---

## Environment Variables

**Public (safe for client-side):**
```
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

**Private (server-side only — never expose to client):**
```
ANTHROPIC_API_KEY=<key>             # Claude API — NEVER in NEXT_PUBLIC_*
SUPABASE_SERVICE_ROLE_KEY=<key>     # Admin operations only
```

**Optional (test seed script):**
```
TEST_TEACHER_EMAIL=test.teacher@voiceiq.local
TEST_TEACHER_PASSWORD=TestPass!123
TEST_TEACHER_NAME=Test Teacher
TEST_TEACHER_SCHOOL=Demo School
```

---

## Running Locally

```bash
cp .env.example .env.local        # Fill in Supabase + Anthropic keys
npm install
npm run dev                        # Runs with NODE_TLS_REJECT_UNAUTHORIZED=0
```

To seed a test teacher account:
```bash
npm run seed:test-user
```

Note: The dev script disables TLS verification (`NODE_TLS_REJECT_UNAUTHORIZED=0`) for local Supabase compatibility.

---

## Important: Do NOT

- **Never** put `ANTHROPIC_API_KEY` in client-side code or `NEXT_PUBLIC_*` env vars
- **Never** call Claude API directly from client components — always proxy through `/api/ai/`
- **Never** store student audio without teacher enabling it in assessment settings
- **Never** expose rubric criteria text (`lib/prompts/rubrics.ts`) to students during assessment
- **Never** reveal to students that they are being scored against a rubric
- **Never** use `localStorage` for student session data — use `sessionStorage` only
- **Never** import from `lib/supabase/server.ts` in a Client Component
- **Never** import from `lib/claude.ts` in a Client Component or API response

---

## Build Phases & Current Status

- **Phase 0** ✅ COMPLETE: Scaffold, types, Claude wrapper, prompts, DB migration
- **Phase 1** ✅ COMPLETE: Auth pages (login, signup, reset-password, update-password), Supabase auth integration
- **Phase 2** ✅ COMPLETE: Teacher dashboard
  - ✅ Dashboard layout + sidebar nav — `components/dashboard/sidebar-nav.tsx`
  - ✅ Classes list — `app/(dashboard)/classes/page.tsx`
  - ✅ Create class — `app/(dashboard)/classes/new/page.tsx`
  - ✅ Class detail — `app/(dashboard)/classes/[id]/page.tsx`
  - ✅ Assessments list — `app/(dashboard)/assessments/page.tsx`
  - ✅ Create assessment — `app/(dashboard)/assessments/new/page.tsx` + `components/teacher/NewAssessmentForm.tsx`
  - ✅ Assessment detail — `app/(dashboard)/assessments/[id]/page.tsx` + `components/teacher/AssessmentActions.tsx`
  - ✅ Reports list — `app/(dashboard)/reports/page.tsx`
  - ✅ Evaluation detail — `app/(dashboard)/reports/evaluation/[id]/page.tsx` + `components/teacher/ReviewButton.tsx`
  - ✅ Update-password page — `app/(auth)/update-password/page.tsx`
  - ✅ Env validation — `lib/supabase/env.ts`
- **Phase 3** ✅ COMPLETE: Core assessment session
  - ✅ Student lobby — `app/(student)/lobby/page.tsx`
  - ✅ Live session — `app/(student)/session/[id]/page.tsx`
  - ✅ Results page — `app/(student)/results/[id]/page.tsx`
  - ✅ Voice interface — `components/assessment/VoiceInterface.tsx`
  - ✅ Conversation feed — `components/assessment/ConversationFeed.tsx`
  - ✅ Results card — `components/assessment/ResultsCard.tsx`
  - ✅ API: question — `app/api/ai/question/route.ts`
  - ✅ API: evaluate — `app/api/ai/evaluate/route.ts`
  - ✅ API: sessions — `app/api/sessions/route.ts`
  - ✅ API: transcripts — `app/api/transcripts/route.ts`
- **Phase 4** ❌ NOT STARTED: Group session mode
  - Waiting room UI with live participant list (`components/assessment/GroupPanel.tsx`)
  - Turn-based speaking with per-student scoring
  - Supabase Realtime for group sync
  - AI detects and redirects to quieter participants
- **Phase 5** ❌ NOT STARTED: PDF export, teacher score override, analytics
  - `TeacherOverrideForm` — override AI criterion scores with justification
  - `ExportButton` — PDF/CSV export of evaluation results
  - `ClassAnalytics` — aggregated class-level criterion charts
  - `LiveSessionMonitor` — real-time teacher view of active sessions

---

## Component Reference

### Implemented (Phase 0–3)

| Component | File | Status |
|-----------|------|--------|
| `VoiceInterface` | `components/assessment/VoiceInterface.tsx` | ✅ Done |
| `ConversationFeed` | `components/assessment/ConversationFeed.tsx` | ✅ Done |
| `ResultsCard` | `components/assessment/ResultsCard.tsx` | ✅ Done |
| `NewAssessmentForm` | `components/teacher/NewAssessmentForm.tsx` | ✅ Done |
| `AssessmentActions` | `components/teacher/AssessmentActions.tsx` | ✅ Done |
| `ReviewButton` | `components/teacher/ReviewButton.tsx` | ✅ Done |
| `sidebar-nav` | `components/dashboard/sidebar-nav.tsx` | ✅ Done |

### Planned (Phase 4–5)

| Component | File | Phase |
|-----------|------|-------|
| `GroupPanel` | `components/assessment/GroupPanel.tsx` | 4 |
| `SessionLobby` | `components/assessment/SessionLobby.tsx` | 4 |
| `LiveSessionMonitor` | `components/teacher/LiveSessionMonitor.tsx` | 5 |
| `TeacherOverrideForm` | `components/teacher/TeacherOverrideForm.tsx` | 5 |
| `ExportButton` | `components/teacher/ExportButton.tsx` | 5 |
| `ClassAnalytics` | `components/teacher/ClassAnalytics.tsx` | 5 |
| `EvaluationTable` | `components/teacher/EvaluationTable.tsx` | 5 |

---

## Key File Locations for AI Assistants

When working on specific features, start with these files:

| Task | Key Files |
|------|-----------|
| Change Claude prompts | `lib/prompts/assessor.ts`, `lib/prompts/rubrics.ts` |
| Add a subject/topic | `lib/prompts/subjects.ts` |
| Modify AI API routes | `app/api/ai/question/route.ts`, `app/api/ai/evaluate/route.ts` |
| Change database types | `lib/types/index.ts`, then update all consumers |
| Add a DB migration | `supabase/migrations/` (new numbered file) |
| Modify student session flow | `app/(student)/session/[id]/page.tsx`, `components/assessment/VoiceInterface.tsx` |
| Add teacher dashboard page | `app/(dashboard)/` + update `components/dashboard/sidebar-nav.tsx` |
| Change auth behaviour | `middleware.ts`, `app/api/auth/`, `lib/supabase/server.ts` |

---

## Font Note
Google Fonts removed (no network in build env). Using Tailwind system font stack (`font-sans`).
`app/layout.tsx` imports only `./globals.css` — no `next/font` import.
