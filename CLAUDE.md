# VoiceIQ – AI Oral Assessment Platform

## Project Overview
VoiceIQ replaces written assessments with AI-conducted oral assessments.
Built for MYP and IB schools. Uses Claude API for Socratic dialogue.
Students answer 6 questions verbally; AI generates MYP criterion-referenced scores.

## Tech Stack
- Next.js 14 (App Router), TypeScript, Tailwind CSS
- Supabase (auth + postgres + storage + realtime)
- Anthropic Claude API (`claude-sonnet-4-20250514`)
- Web Speech API (browser native STT/TTS)
- Vercel deployment

## Key Conventions
- All Claude API calls go through `lib/claude.ts` wrapper — never inline
- System prompts live in `lib/prompts/` — never hardcode inline or in components
- Use `lib/supabase/server.ts` for API routes and Server Components
- Use `lib/supabase/client.ts` for Client Components only
- All DB access uses typed interfaces from `lib/types/index.ts`
- Assessment session state is managed in Supabase, not in client state
- Never call Claude API from client-side code — always use `/api/ai/` routes

## Directory Structure
```
app/
  (auth)/          Login, signup, reset-password
  (dashboard)/     Teacher dashboard — requires Supabase auth
  (student)/       Student-facing — code-gated, no auth required
  api/ai/          Claude API proxy routes (question, evaluate)
  api/sessions/    Session creation and management
  api/transcripts/ Message storage
components/
  assessment/      VoiceInterface, ConversationFeed, GroupPanel, ResultsCard
  teacher/         Dashboard components
  ui/              shadcn/ui base components
lib/
  claude.ts        Anthropic SDK wrapper
  prompts/         assessor.ts, rubrics.ts, subjects.ts
  supabase/        client.ts, server.ts
  types/           index.ts — all TypeScript interfaces
supabase/
  migrations/      SQL migration files
```

## MYP Assessment Context
- Criterion A (1–8 scale): Knowing and Understanding
- Criterion B (1–8 scale): Inquiring and Designing
- Criterion C (1–8 scale): Processing and Evaluating
- Criterion D (1–8 scale): Reflecting on Impacts of Science
- MVP focus: MYP Year 4 Physics (Waves, Electricity, Forces & Motion)

## Student Flow (No Auth Required)
1. Student enters 6-char access code + name at `/lobby`
2. POST `/api/sessions` validates code → creates session → returns session_id + participant_id
3. Client stores these in `sessionStorage` (not cookies, not localStorage)
4. Session page (`/session/[id]`) fetches first question from `/api/ai/question`
5. After max_questions, POST `/api/ai/evaluate` → redirects to `/results/[eval_id]`

## Running Locally
```bash
cp .env.example .env.local   # Fill in Supabase + Anthropic keys
npm install
npm run dev
```

## Database
Run `supabase/migrations/001_initial_schema.sql` against your Supabase project.
All tables have Row Level Security enabled. See migration file for policies.

## Important: Do NOT
- Never put `ANTHROPIC_API_KEY` in client-side code or environment variables prefixed `NEXT_PUBLIC_`
- Never call Claude API directly from client — use `/api/ai/` routes only
- Never store student audio without teacher enabling it in assessment settings
- Never expose rubric criteria text (`lib/prompts/rubrics.ts`) to students during assessment
- Never reveal to students that they are being scored against a rubric

## Build Phases & Current Status

- **Phase 0** ✅ COMPLETE: Scaffold, types, Claude wrapper, prompts, DB migration
- **Phase 1** ✅ COMPLETE: Auth pages (login, signup, reset-password), Supabase auth integration
- **Phase 2** ✅ COMPLETE: Teacher dashboard
  - ✅ Dashboard layout + nav — `components/dashboard/sidebar-nav.tsx`
  - ✅ Classes list page (`/classes`)
  - ✅ Create class UI (`/classes/new`)
  - ✅ Class detail page (`/classes/[id]`) — shows assessments for the class
  - ✅ Assessments list page (`/assessments`)
  - ✅ Create assessment UI (`/assessments/new`) — `components/teacher/NewAssessmentForm.tsx`
  - ✅ Assessment detail page (`/assessments/[id]`) — status toggle, access code, sessions list — `components/teacher/AssessmentActions.tsx`
  - ✅ Reports list page (`/reports`)
  - ✅ Evaluation detail page (`/reports/evaluation/[id]`) — `components/teacher/ReviewButton.tsx`
  - ✅ Update-password page (`/update-password`) — password reset flow
  - ✅ Env validation helper — `lib/supabase/env.ts`
- **Phase 3** ✅ COMPLETE: Core assessment session (lobby, session, voice, results, all API routes)
- **Phase 4** ❌ NOT STARTED: Group session mode
- **Phase 5** ❌ NOT STARTED: PDF export, teacher score override, analytics

## Font Note
Google Fonts removed (no network in build env). Using Tailwind system font stack (`font-sans`).
`app/layout.tsx` imports only `./globals.css` — no `next/font` import.
